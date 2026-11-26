<?php
/**
 * Community features for the headless front end.
 *
 * - Enables comments on the `reviews` post type and opens existing reviews.
 * - Exposes `/worthsprout/v1/me` so profile management keeps working when the
 *   public `/wp/v2/users` routes are blocked (user enumeration protection).
 * - Warns the site owner when Simple JWT Login's REST middleware is off, which
 *   is what makes `Authorization: Bearer <jwt>` authenticate front-end requests.
 *
 * @package WorthSprout
 */

if (!defined('ABSPATH')) {
    exit;
}

const WS_COMMUNITY_MIGRATION_OPTION = 'ws_community_reviews_comments';
const WS_COMMUNITY_MIGRATION_VERSION = '1';
const WS_COMMUNITY_JWT_MAPPING_OPTION = 'ws_community_jwt_mapping_fixed';
const WS_COMMUNITY_DB_OPTION = 'ws_community_db_version';
const WS_COMMUNITY_DB_VERSION = '1';

/**
 * The reviews post type is registered outside this plugin, so attach comment
 * support both after `init:10` registrations and on the `registered_post_type`
 * hook for anything that registers later.
 */
function ws_community_enable_review_comments(): void
{
    add_post_type_support('reviews', 'comments');
}
add_action('init', 'ws_community_enable_review_comments', 99);
add_action('registered_post_type', function (string $post_type): void {
    if ($post_type === 'reviews') {
        ws_community_enable_review_comments();
    }
});

/** New reviews start with comments open even if the site default is closed. */
add_filter('get_default_comment_status', function ($status, $post_type, $comment_type) {
    if ($post_type === 'reviews' && $comment_type === 'comment') {
        return 'open';
    }

    return $status;
}, 10, 3);

/**
 * Open comments on reviews that were created before the post type supported
 * them. Updating `comment_status` directly keeps `post_modified` untouched, so
 * existing articles do not suddenly claim to be freshly updated.
 */
function ws_community_open_existing_review_comments(): void
{
    if (get_option(WS_COMMUNITY_MIGRATION_OPTION) === WS_COMMUNITY_MIGRATION_VERSION) {
        return;
    }

    if (wp_installing() || !post_type_exists('reviews')) {
        return;
    }

    global $wpdb;

    $ids = $wpdb->get_col(
        $wpdb->prepare(
            "SELECT ID FROM {$wpdb->posts} WHERE post_type = %s AND post_status NOT IN ('trash', 'auto-draft', 'inherit') AND comment_status <> 'open'",
            'reviews'
        )
    );

    foreach ($ids as $id) {
        $wpdb->update(
            $wpdb->posts,
            ['comment_status' => 'open'],
            ['ID' => (int) $id],
            ['%s'],
            ['%d']
        );
        clean_post_cache((int) $id);
    }

    update_option(WS_COMMUNITY_MIGRATION_OPTION, WS_COMMUNITY_MIGRATION_VERSION, true);
}
add_action('wp_loaded', 'ws_community_open_existing_review_comments');

/**
 * Simple JWT Login maps a token to a WordPress user through a payload key. A
 * fresh install can have that key blank, which makes every authenticated REST
 * request fail with "Unable to find user property in JWT". Fill it once while
 * preserving the configured identification mode (email / ID / username).
 */
function ws_community_fix_jwt_user_mapping(): void
{
    if (get_option(WS_COMMUNITY_JWT_MAPPING_OPTION)) {
        return;
    }

    if (!defined('SIMPLE_JWT_LOGIN_PLUGIN_FILE')) {
        return;
    }

    $raw = get_option('simple_jwt_login_settings');
    if (!$raw) {
        return;
    }

    $settings = is_array($raw) ? $raw : json_decode((string) $raw, true);
    if (!is_array($settings) || !isset($settings['login']) || !is_array($settings['login'])) {
        return;
    }

    $parameter = isset($settings['login']['login_by_parameter'])
        ? trim((string) $settings['login']['login_by_parameter'])
        : '';

    if ($parameter !== '') {
        update_option(WS_COMMUNITY_JWT_MAPPING_OPTION, 1, true);
        return;
    }

    $login_by = isset($settings['login']['login_by']) ? (int) $settings['login']['login_by'] : 0;
    $keys = [0 => 'email', 1 => 'id', 2 => 'username'];
    $settings['login']['login_by_parameter'] = isset($keys[$login_by]) ? $keys[$login_by] : 'email';

    update_option('simple_jwt_login_settings', wp_json_encode($settings));
    update_option(WS_COMMUNITY_JWT_MAPPING_OPTION, 1, true);
}
add_action('wp_loaded', 'ws_community_fix_jwt_user_mapping', 20);

/* --------------------------------------------------------- likes & shares */

/** Table name for a community table (`reactions` or `shares`). */
function ws_community_table(string $name): string
{
    global $wpdb;

    return $wpdb->prefix . 'ws_' . $name;
}

/** Create/upgrade the reaction and share tables after a plugin update. */
function ws_community_maybe_install_tables(): void
{
    if (get_option(WS_COMMUNITY_DB_OPTION) === WS_COMMUNITY_DB_VERSION) {
        return;
    }

    if (wp_installing()) {
        return;
    }

    global $wpdb;

    require_once ABSPATH . 'wp-admin/includes/upgrade.php';

    $charset_collate = $wpdb->get_charset_collate();
    $reactions = ws_community_table('reactions');
    $shares = ws_community_table('shares');

    dbDelta("CREATE TABLE {$reactions} (
        id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
        user_id bigint(20) unsigned NOT NULL,
        post_id bigint(20) unsigned NOT NULL,
        kind varchar(20) NOT NULL,
        created_at datetime NOT NULL,
        PRIMARY KEY  (id),
        UNIQUE KEY user_post_kind (user_id,post_id,kind),
        KEY post_kind (post_id,kind),
        KEY user_created (user_id,created_at)
    ) {$charset_collate};");

    dbDelta("CREATE TABLE {$shares} (
        id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
        user_id bigint(20) unsigned NOT NULL DEFAULT 0,
        post_id bigint(20) unsigned NOT NULL,
        channel varchar(32) NOT NULL DEFAULT '',
        created_at datetime NOT NULL,
        PRIMARY KEY  (id),
        KEY post_created (post_id,created_at),
        KEY user_created (user_id,created_at)
    ) {$charset_collate};");

    update_option(WS_COMMUNITY_DB_OPTION, WS_COMMUNITY_DB_VERSION, true);
}
add_action('init', 'ws_community_maybe_install_tables', 5);

/** UTC timestamp in the same format WordPress stores. */
function ws_community_now(): string
{
    return current_time('mysql', true);
}

/** MySQL GMT datetime -> ISO-8601 for `new Date()` in the browser. */
function ws_community_iso(string $mysql_gmt): string
{
    return str_replace(' ', 'T', $mysql_gmt) . 'Z';
}

/** Published, publicly viewable post or null. */
function ws_community_get_viewable_post($post_id): ?WP_Post
{
    $post = get_post((int) $post_id);
    if (!$post || $post->post_status !== 'publish') {
        return null;
    }

    if (!is_post_type_viewable($post->post_type)) {
        return null;
    }

    return $post;
}

/** Counts and the current user's own state for one post. */
function ws_community_post_stats(int $post_id, int $user_id = 0): array
{
    global $wpdb;

    $reactions = ws_community_table('reactions');
    $shares = ws_community_table('shares');

    $likes = (int) $wpdb->get_var(
        $wpdb->prepare("SELECT COUNT(*) FROM {$reactions} WHERE post_id = %d AND kind = %s", $post_id, 'like')
    );
    $saves = (int) $wpdb->get_var(
        $wpdb->prepare("SELECT COUNT(*) FROM {$reactions} WHERE post_id = %d AND kind = %s", $post_id, 'save')
    );
    $share_count = (int) $wpdb->get_var(
        $wpdb->prepare("SELECT COUNT(*) FROM {$shares} WHERE post_id = %d", $post_id)
    );

    $comment_counts = wp_count_comments($post_id);
    $comments = isset($comment_counts->approved) ? (int) $comment_counts->approved : 0;

    $liked = false;
    $saved = false;

    if ($user_id > 0) {
        $liked = (bool) $wpdb->get_var(
            $wpdb->prepare(
                "SELECT 1 FROM {$reactions} WHERE user_id = %d AND post_id = %d AND kind = %s LIMIT 1",
                $user_id,
                $post_id,
                'like'
            )
        );
        $saved = (bool) $wpdb->get_var(
            $wpdb->prepare(
                "SELECT 1 FROM {$reactions} WHERE user_id = %d AND post_id = %d AND kind = %s LIMIT 1",
                $user_id,
                $post_id,
                'save'
            )
        );
    }

    return [
        'postId'   => $post_id,
        'likes'    => $likes,
        'saves'    => $saves,
        'shares'   => $share_count,
        'comments' => $comments,
        'liked'    => $liked,
        'saved'    => $saved,
    ];
}

/** Remove a deleted user's reactions and shares. */
function ws_community_delete_user_data($user_id): void
{
    global $wpdb;

    $user_id = (int) $user_id;
    if ($user_id <= 0) {
        return;
    }

    $wpdb->delete(ws_community_table('reactions'), ['user_id' => $user_id], ['%d']);
    $wpdb->delete(ws_community_table('shares'), ['user_id' => $user_id], ['%d']);
}
add_action('deleted_user', 'ws_community_delete_user_data');
add_action('wpmu_delete_user', 'ws_community_delete_user_data');

/* ------------------------------------------------------------------ REST */

function ws_community_error(string $code, string $message, int $status): WP_Error
{
    return new WP_Error($code, $message, ['status' => $status]);
}

function ws_community_require_login()
{
    if (!is_user_logged_in()) {
        return ws_community_error(
            'rest_not_logged_in',
            'You must be logged in to manage your profile.',
            401
        );
    }

    return true;
}

function ws_community_user_payload($user): ?array
{
    if (!$user instanceof WP_User) {
        return null;
    }

    $avatar_96 = get_avatar_url($user->ID, ['size' => 96]);
    $avatar_48 = get_avatar_url($user->ID, ['size' => 48]);

    $avatar_urls = [];
    if (is_string($avatar_96) && $avatar_96 !== '') {
        $avatar_urls['96'] = $avatar_96;
    }
    if (is_string($avatar_48) && $avatar_48 !== '') {
        $avatar_urls['48'] = $avatar_48;
    }

    return [
        'id'          => (int) $user->ID,
        'username'    => $user->user_login,
        'name'        => $user->display_name !== '' ? $user->display_name : $user->user_login,
        'email'       => $user->user_email,
        'description' => $user->description,
        'avatar_urls' => $avatar_urls,
    ];
}

function ws_community_rest_get_me()
{
    $payload = ws_community_user_payload(wp_get_current_user());
    if ($payload === null) {
        return ws_community_error('rest_user_not_found', 'Your profile could not be loaded.', 404);
    }

    return rest_ensure_response($payload);
}

function ws_community_rest_update_me(WP_REST_Request $request)
{
    $user = wp_get_current_user();
    $updates = ['ID' => $user->ID];

    if ($request->has_param('name')) {
        $name = sanitize_text_field((string) $request->get_param('name'));
        if ($name === '') {
            return ws_community_error('rest_user_invalid_name', 'Display name cannot be empty.', 400);
        }
        $updates['display_name'] = $name;
    }

    if ($request->has_param('email')) {
        $email = sanitize_email((string) $request->get_param('email'));
        if ($email === '' || !is_email($email)) {
            return ws_community_error('rest_user_invalid_email', 'Please enter a valid email address.', 400);
        }

        $owner = email_exists($email);
        if ($owner && (int) $owner !== (int) $user->ID) {
            return ws_community_error('existing_user_email', 'That email address is already registered.', 409);
        }

        $updates['user_email'] = $email;
    }

    if ($request->has_param('description')) {
        $updates['description'] = sanitize_textarea_field((string) $request->get_param('description'));
    }

    $password = (string) $request->get_param('password');
    if ($password !== '') {
        $current_password = (string) $request->get_param('currentPassword');
        if ($current_password === '') {
            return ws_community_error(
                'rest_user_missing_current_password',
                'Enter your current password to set a new one.',
                400
            );
        }

        if (!wp_check_password($current_password, $user->user_pass, $user->ID)) {
            return ws_community_error('incorrect_password', 'Your current password is incorrect.', 403);
        }

        if (strlen($password) < 6) {
            return ws_community_error('rest_user_invalid_password', 'Password must be at least 6 characters.', 400);
        }

        $updates['user_pass'] = $password;
    }

    $result = wp_update_user($updates);
    if (is_wp_error($result)) {
        return $result;
    }

    $payload = ws_community_user_payload(get_userdata($user->ID));
    if ($payload === null) {
        return ws_community_error('rest_user_not_found', 'Your profile could not be loaded.', 404);
    }

    return rest_ensure_response($payload);
}

function ws_community_rest_delete_me(WP_REST_Request $request)
{
    $user = wp_get_current_user();

    $password = (string) $request->get_param('password');
    if ($password === '') {
        return ws_community_error(
            'rest_user_missing_password',
            'Enter your password to delete your account.',
            400
        );
    }

    if (!wp_check_password($password, $user->user_pass, $user->ID)) {
        return ws_community_error('incorrect_password', 'Your password is incorrect.', 403);
    }

    // Never let the last administrator delete the only account that can manage the site.
    if (user_can($user, 'manage_options')) {
        $admins = get_users(['role' => 'administrator', 'fields' => 'ID']);
        if (count($admins) <= 1) {
            return ws_community_error(
                'rest_user_last_admin',
                'You are the only administrator. Transfer ownership before deleting this account.',
                409
            );
        }
    }

    require_once ABSPATH . 'wp-admin/includes/user.php';

    $admins = get_users([
        'role'    => 'administrator',
        'number'  => 1,
        'fields'  => 'ID',
        'exclude' => [$user->ID],
    ]);
    $reassign = !empty($admins) ? (int) $admins[0] : null;

    if (is_multisite()) {
        require_once ABSPATH . 'wp-admin/includes/ms.php';
        $deleted = wpmu_delete_user($user->ID);
    } else {
        $deleted = wp_delete_user($user->ID, $reassign);
    }

    if (!$deleted) {
        return ws_community_error(
            'rest_user_delete_failed',
            'Your account could not be deleted. Please contact the site owner.',
            500
        );
    }

    return rest_ensure_response(['deleted' => true]);
}

function ws_community_rest_delete_own_comment(WP_REST_Request $request)
{
    $comment_id = (int) $request['id'];
    $comment = get_comment($comment_id);

    if (!$comment || (int) $comment->user_id !== get_current_user_id()) {
        return ws_community_error(
            'rest_comment_forbidden',
            'You can only delete your own comments.',
            403
        );
    }

    if (!wp_delete_comment($comment_id, true)) {
        return ws_community_error(
            'rest_comment_delete_failed',
            'Your comment could not be deleted.',
            500
        );
    }

    return rest_ensure_response(['deleted' => true]);
}

function ws_community_rest_post_stats(WP_REST_Request $request)
{
    $post = ws_community_get_viewable_post((int) $request['id']);
    if ($post === null) {
        return ws_community_error('rest_post_invalid_id', 'This article is no longer available.', 404);
    }

    return rest_ensure_response(ws_community_post_stats($post->ID, get_current_user_id()));
}

function ws_community_rest_toggle_reaction(WP_REST_Request $request)
{
    $post = ws_community_get_viewable_post((int) $request['id']);
    if ($post === null) {
        return ws_community_error('rest_post_invalid_id', 'This article is no longer available.', 404);
    }

    $kind = (string) $request['kind'];
    if ($kind !== 'like' && $kind !== 'save') {
        return ws_community_error('rest_invalid_param', 'Unknown reaction type.', 400);
    }

    global $wpdb;

    $user_id = get_current_user_id();
    $reactions = ws_community_table('reactions');

    $existing = $wpdb->get_var(
        $wpdb->prepare(
            "SELECT id FROM {$reactions} WHERE user_id = %d AND post_id = %d AND kind = %s LIMIT 1",
            $user_id,
            $post->ID,
            $kind
        )
    );

    if ($existing) {
        $deleted = $wpdb->delete($reactions, ['id' => (int) $existing], ['%d']);
        if ($deleted === false) {
            return ws_community_error('rest_reaction_failed', 'Your reaction could not be saved.', 500);
        }
    } else {
        $inserted = $wpdb->insert(
            $reactions,
            [
                'user_id'    => $user_id,
                'post_id'    => $post->ID,
                'kind'       => $kind,
                'created_at' => ws_community_now(),
            ],
            ['%d', '%d', '%s', '%s']
        );

        if ($inserted === false) {
            return ws_community_error('rest_reaction_failed', 'Your reaction could not be saved.', 500);
        }
    }

    return rest_ensure_response(ws_community_post_stats($post->ID, $user_id));
}

function ws_community_rest_record_share(WP_REST_Request $request)
{
    $post = ws_community_get_viewable_post((int) $request['id']);
    if ($post === null) {
        return ws_community_error('rest_post_invalid_id', 'This article is no longer available.', 404);
    }

    $channel = sanitize_key((string) $request->get_param('channel'));
    if ($channel === '') {
        $channel = 'copy';
    }

    $allowed = ['native', 'copy', 'x', 'facebook', 'linkedin', 'email', 'other'];
    if (!in_array($channel, $allowed, true)) {
        $channel = 'other';
    }

    // Basic abuse guard: at most 60 share events per IP per hour.
    $ip = '';
    if (!empty($_SERVER['HTTP_CF_CONNECTING_IP'])) {
        $ip = sanitize_text_field(wp_unslash($_SERVER['HTTP_CF_CONNECTING_IP']));
    } elseif (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
        $forwarded = explode(',', (string) wp_unslash($_SERVER['HTTP_X_FORWARDED_FOR']));
        $ip = sanitize_text_field(trim($forwarded[0]));
    } elseif (isset($_SERVER['REMOTE_ADDR'])) {
        $ip = sanitize_text_field(wp_unslash($_SERVER['REMOTE_ADDR']));
    }

    if ($ip !== '') {
        $key = 'ws_share_' . md5($ip);
        $count = (int) get_transient($key);
        if ($count >= 60) {
            return ws_community_error('rest_too_many_requests', 'Too many shares. Please try again later.', 429);
        }
        set_transient($key, $count + 1, HOUR_IN_SECONDS);
    }

    global $wpdb;

    $inserted = $wpdb->insert(
        ws_community_table('shares'),
        [
            'user_id'    => get_current_user_id(),
            'post_id'    => $post->ID,
            'channel'    => $channel,
            'created_at' => ws_community_now(),
        ],
        ['%d', '%d', '%s', '%s']
    );

    if ($inserted === false) {
        return ws_community_error('rest_share_failed', 'Your share could not be recorded.', 500);
    }

    return rest_ensure_response(ws_community_post_stats($post->ID, get_current_user_id()));
}

function ws_community_activity_item(array $row): array
{
    return [
        'postId'    => (int) $row['post_id'],
        'postSlug'  => (string) $row['post_name'],
        'postTitle' => wp_strip_all_tags(html_entity_decode((string) $row['post_title'], ENT_QUOTES, 'UTF-8')),
        'postType'  => (string) $row['post_type'],
        'createdAt' => ws_community_iso((string) $row['created_at']),
    ];
}

function ws_community_rest_my_activity()
{
    global $wpdb;

    $user_id = get_current_user_id();
    $reactions = ws_community_table('reactions');
    $shares = ws_community_table('shares');

    $reaction_rows = $wpdb->get_results(
        $wpdb->prepare(
            "SELECT r.post_id, r.kind, r.created_at, p.post_title, p.post_name, p.post_type
             FROM {$reactions} r
             INNER JOIN {$wpdb->posts} p ON p.ID = r.post_id
             WHERE r.user_id = %d AND p.post_status = 'publish'
             ORDER BY r.created_at DESC
             LIMIT 50",
            $user_id
        ),
        ARRAY_A
    );

    $likes = [];
    $saves = [];

    foreach ((array) $reaction_rows as $row) {
        $item = ws_community_activity_item($row);
        if ($row['kind'] === 'like') {
            $likes[] = $item;
        } else {
            $saves[] = $item;
        }
    }

    $share_rows = $wpdb->get_results(
        $wpdb->prepare(
            "SELECT s.post_id, s.channel, s.created_at, p.post_title, p.post_name, p.post_type
             FROM {$shares} s
             INNER JOIN {$wpdb->posts} p ON p.ID = s.post_id
             WHERE s.user_id = %d AND p.post_status = 'publish'
             ORDER BY s.created_at DESC
             LIMIT 50",
            $user_id
        ),
        ARRAY_A
    );

    $share_items = [];
    foreach ((array) $share_rows as $row) {
        $item = ws_community_activity_item($row);
        $item['channel'] = (string) $row['channel'];
        $share_items[] = $item;
    }

    $comment_rows = get_comments([
        'user_id' => $user_id,
        'status'  => 'all',
        'number'  => 50,
        'orderby' => 'comment_date_gmt',
        'order'   => 'DESC',
    ]);

    $comment_items = [];
    foreach ($comment_rows as $comment) {
        $post = get_post((int) $comment->comment_post_ID);
        if (!$post || $post->post_status !== 'publish') {
            continue;
        }

        $status = wp_get_comment_status($comment);
        if ($status === 'unapproved') {
            $status = 'hold';
        }

        $comment_items[] = [
            'id'        => (int) $comment->comment_ID,
            'postId'    => (int) $post->ID,
            'postSlug'  => (string) $post->post_name,
            'postTitle' => wp_strip_all_tags(html_entity_decode((string) get_the_title($post), ENT_QUOTES, 'UTF-8')),
            'postType'  => (string) $post->post_type,
            'excerpt'   => wp_trim_words(wp_strip_all_tags((string) $comment->comment_content), 28),
            'status'    => (string) $status,
            'createdAt' => ws_community_iso((string) $comment->comment_date_gmt),
        ];
    }

    return rest_ensure_response([
        'comments' => $comment_items,
        'likes'    => $likes,
        'saves'    => $saves,
        'shares'   => $share_items,
        'totals'   => [
            'comments' => (int) get_comments(['user_id' => $user_id, 'status' => 'all', 'count' => true]),
            'likes'    => (int) $wpdb->get_var(
                $wpdb->prepare("SELECT COUNT(*) FROM {$reactions} WHERE user_id = %d AND kind = %s", $user_id, 'like')
            ),
            'saves'    => (int) $wpdb->get_var(
                $wpdb->prepare("SELECT COUNT(*) FROM {$reactions} WHERE user_id = %d AND kind = %s", $user_id, 'save')
            ),
            'shares'   => (int) $wpdb->get_var(
                $wpdb->prepare("SELECT COUNT(*) FROM {$shares} WHERE user_id = %d", $user_id)
            ),
        ],
    ]);
}

add_action('rest_api_init', function (): void {
    register_rest_route('worthsprout/v1', '/posts/(?P<id>\d+)/stats', [
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'ws_community_rest_post_stats',
        'permission_callback' => '__return_true',
        'args'                => [
            'id' => [
                'required'          => true,
                'validate_callback' => function ($value) {
                    return is_numeric($value) && (int) $value > 0;
                },
            ],
        ],
    ]);

    register_rest_route('worthsprout/v1', '/posts/(?P<id>\d+)/(?P<kind>like|save)', [
        'methods'             => WP_REST_Server::CREATABLE,
        'callback'            => 'ws_community_rest_toggle_reaction',
        'permission_callback' => 'ws_community_require_login',
    ]);

    register_rest_route('worthsprout/v1', '/posts/(?P<id>\d+)/share', [
        'methods'             => WP_REST_Server::CREATABLE,
        'callback'            => 'ws_community_rest_record_share',
        'permission_callback' => '__return_true',
    ]);

    register_rest_route('worthsprout/v1', '/me/activity', [
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'ws_community_rest_my_activity',
        'permission_callback' => 'ws_community_require_login',
    ]);

    register_rest_route('worthsprout/v1', '/comments/(?P<id>\d+)', [
        'methods'             => WP_REST_Server::DELETABLE,
        'callback'            => 'ws_community_rest_delete_own_comment',
        'permission_callback' => 'ws_community_require_login',
        'args'                => [
            'id' => [
                'required'          => true,
                'validate_callback' => function ($value) {
                    return is_numeric($value) && (int) $value > 0;
                },
            ],
        ],
    ]);

    register_rest_route('worthsprout/v1', '/me', [
        [
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => 'ws_community_rest_get_me',
            'permission_callback' => 'ws_community_require_login',
        ],
        [
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => 'ws_community_rest_update_me',
            'permission_callback' => 'ws_community_require_login',
        ],
        [
            'methods'             => WP_REST_Server::DELETABLE,
            'callback'            => 'ws_community_rest_delete_me',
            'permission_callback' => 'ws_community_require_login',
        ],
    ]);
});

/* ------------------------------------------------------------ admin notice */

/**
 * State of Simple JWT Login's REST middleware: true = on, false = off,
 * null = plugin or setting not found.
 */
function ws_community_jwt_middleware_state(): ?bool
{
    if (!defined('SIMPLE_JWT_LOGIN_PLUGIN_FILE')) {
        return null;
    }

    $raw = get_option('simple_jwt_login_settings');
    if (!$raw) {
        // Plugin active, settings never saved: the middleware default is off.
        return false;
    }

    $settings = is_array($raw) ? $raw : json_decode((string) $raw, true);
    if (!is_array($settings) || !isset($settings['api_middleware']['enabled'])) {
        return false;
    }

    return !empty($settings['api_middleware']['enabled']);
}

add_action('admin_notices', function (): void {
    if (!current_user_can('manage_options') || ws_community_jwt_middleware_state() !== false) {
        return;
    }

    $settings_url = admin_url('admin.php?page=main-page-simple-jwt-login-plugin');

    echo '<div class="notice notice-warning"><p><strong>WorthSprout:</strong> JWT requests are not authenticated on the REST API, so readers cannot comment or manage their profile. Open <a href="' . esc_url($settings_url) . '">Simple JWT Login &rarr; General</a> and enable <em>JWT Middleware for all WordPress endpoints</em>. If the front end runs on a different domain, add that origin under <em>CORS &rarr; Allow origin</em> as well.</p></div>';
});
