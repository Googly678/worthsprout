<?php
/**
 * Comment report moderation screen.
 *
 * Reports are submitted from the headless front end through
 * `/worthsprout/v1/comments/{id}/report`; this screen is where an editor
 * reviews them and either deletes the comment or dismisses the report.
 *
 * @package WorthSprout
 */

if (!defined('ABSPATH')) {
    exit;
}

function ws_community_pending_report_count(): int
{
    global $wpdb;

    return (int) $wpdb->get_var(
        'SELECT COUNT(*) FROM ' . ws_community_table('reports') . " WHERE status = 'pending'"
    );
}

function ws_community_report_reason_label(string $reason): string
{
    $labels = [
        'spam'           => 'Spam',
        'harassment'     => 'Harassment',
        'misinformation' => 'Misinformation',
        'off_topic'      => 'Off-topic',
        'other'          => 'Other',
    ];

    return $labels[$reason] ?? 'Other';
}

function ws_community_admin_reports_menu(): void
{
    $count = ws_community_pending_report_count();
    $label = 'Reported Comments';

    if ($count > 0) {
        $label .= ' <span class="awaiting-mod">' . number_format_i18n($count) . '</span>';
    }

    add_submenu_page(
        'edit-comments.php',
        'Reported Comments',
        $label,
        'moderate_comments',
        'ws-reports',
        'ws_community_render_reports_page'
    );
}
add_action('admin_menu', 'ws_community_admin_reports_menu');

function ws_community_handle_report_decision(): void
{
    if (!current_user_can('moderate_comments')) {
        wp_die(esc_html('You are not allowed to moderate comments.'), '', ['response' => 403]);
    }

    $report_id = isset($_POST['report_id']) ? absint($_POST['report_id']) : 0;
    check_admin_referer('ws_report_decision_' . $report_id);

    $decision = isset($_POST['decision']) ? sanitize_key(wp_unslash($_POST['decision'])) : '';
    $notice = 'invalid';

    if ($report_id > 0 && in_array($decision, ['dismiss', 'delete'], true)) {
        global $wpdb;

        $report = $wpdb->get_row(
            $wpdb->prepare('SELECT * FROM ' . ws_community_table('reports') . ' WHERE id = %d', $report_id),
            ARRAY_A
        );

        if ($report && $report['status'] !== 'pending') {
            $notice = 'missing';
        } elseif ($report) {
            if ($decision === 'delete') {
                $comment_id = (int) $report['comment_id'];
                $deleted = true;

                if (get_comment($comment_id)) {
                    $deleted = (bool) wp_delete_comment($comment_id, true);
                }

                if ($deleted) {
                    // Covers a comment that was already deleted outside this screen.
                    ws_community_resolve_reports_for_comment(
                        $comment_id,
                        'resolved',
                        get_current_user_id(),
                        true
                    );
                    $notice = 'deleted';
                } else {
                    $notice = 'invalid';
                }
            } else {
                ws_community_resolve_report_row($report, 'dismissed', get_current_user_id(), true);
                $notice = 'dismissed';
            }
        } else {
            $notice = 'missing';
        }
    }

    wp_safe_redirect(
        add_query_arg(
            ['page' => 'ws-reports', 'ws_notice' => $notice],
            admin_url('edit-comments.php')
        )
    );
    exit;
}
add_action('admin_post_ws_resolve_report', 'ws_community_handle_report_decision');

function ws_community_render_reports_page(): void
{
    if (!current_user_can('moderate_comments')) {
        return;
    }

    global $wpdb;

    $reports_table = ws_community_table('reports');
    $status = isset($_GET['status']) ? sanitize_key(wp_unslash($_GET['status'])) : 'pending';
    if (!in_array($status, ['pending', 'resolved', 'dismissed', 'all'], true)) {
        $status = 'pending';
    }

    $paged = isset($_GET['paged']) ? max(1, absint($_GET['paged'])) : 1;
    $per_page = 50;
    $offset = ($paged - 1) * $per_page;

    $counts = [];
    foreach (['pending', 'resolved', 'dismissed'] as $state) {
        $counts[$state] = (int) $wpdb->get_var(
            $wpdb->prepare("SELECT COUNT(*) FROM {$reports_table} WHERE status = %s", $state)
        );
    }
    $counts['all'] = array_sum($counts);

    $where = $status === 'all' ? '1=1' : $wpdb->prepare('r.status = %s', $status);

    $total = (int) $wpdb->get_var("SELECT COUNT(*) FROM {$reports_table} r WHERE {$where}");

    $rows = $wpdb->get_results(
        $wpdb->prepare(
            "SELECT r.*, c.comment_content, c.comment_author, c.comment_post_ID, p.post_title
             FROM {$reports_table} r
             LEFT JOIN {$wpdb->comments} c ON c.comment_ID = r.comment_id
             LEFT JOIN {$wpdb->posts} p ON p.ID = r.post_id
             WHERE {$where}
             ORDER BY r.created_at DESC, r.id DESC
             LIMIT %d OFFSET %d",
            $per_page,
            $offset
        ),
        ARRAY_A
    );

    $base_url = admin_url('edit-comments.php?page=ws-reports');
    $labels = [
        'pending'   => 'Pending',
        'resolved'  => 'Resolved',
        'dismissed' => 'Dismissed',
        'all'       => 'All',
    ];

    $notices = [
        'deleted'   => ['success', 'Comment deleted and every pending report on it was resolved.'],
        'dismissed' => ['success', 'Report dismissed. The comment was kept and the reporter was notified.'],
        'missing'   => ['warning', 'That report no longer exists.'],
        'invalid'   => ['warning', 'The moderation action could not be processed.'],
    ];
    ?>
    <div class="wrap">
        <h1>Reported Comments</h1>

        <?php if (isset($_GET['ws_notice']) && isset($notices[sanitize_key(wp_unslash($_GET['ws_notice']))])) :
            $notice = $notices[sanitize_key(wp_unslash($_GET['ws_notice']))];
            ?>
            <div class="notice notice-<?php echo esc_attr($notice[0]); ?> is-dismissible">
                <p><?php echo esc_html($notice[1]); ?></p>
            </div>
        <?php endif; ?>

        <ul class="subsubsub">
            <?php foreach ($labels as $key => $label) : ?>
                <li>
                    <a
                        href="<?php echo esc_url(add_query_arg('status', $key, $base_url)); ?>"
                        class="<?php echo $status === $key ? 'current' : ''; ?>"
                    >
                        <?php echo esc_html($label); ?>
                        <span class="count">(<?php echo esc_html(number_format_i18n($counts[$key] ?? 0)); ?>)</span>
                    </a>
                    <?php echo $key !== 'all' ? ' |' : ''; ?>
                </li>
            <?php endforeach; ?>
        </ul>

        <table class="wp-list-table widefat fixed striped">
            <thead>
                <tr>
                    <th scope="col">Comment</th>
                    <th scope="col">Reported by</th>
                    <th scope="col">Reason</th>
                    <th scope="col">Details</th>
                    <th scope="col">Date</th>
                    <th scope="col">Actions</th>
                </tr>
            </thead>
            <tbody>
                <?php if (empty($rows)) : ?>
                    <tr>
                        <td colspan="6">No reports found.</td>
                    </tr>
                <?php else : ?>
                    <?php foreach ($rows as $row) :
                        $comment_id = (int) $row['comment_id'];
                        $post_id = (int) $row['post_id'];
                        if ($post_id <= 0 && (int) $row['comment_post_ID'] > 0) {
                            $post_id = (int) $row['comment_post_ID'];
                        }
                        $post = $post_id > 0 ? get_post($post_id) : null;
                        $reporter_id = (int) $row['reporter_id'];
                        $reporter = $reporter_id > 0 ? get_userdata($reporter_id) : false;
                        $reporter_name = $reporter
                            ? ($reporter->display_name !== '' ? $reporter->display_name : $reporter->user_login)
                            : 'Deleted user';
                        $resolver = (int) $row['resolved_by'] > 0 ? get_userdata((int) $row['resolved_by']) : false;
                        ?>
                        <tr>
                            <td>
                                <?php if ($row['comment_content'] !== null) : ?>
                                    <strong><?php echo esc_html($row['comment_author'] !== '' ? $row['comment_author'] : 'Anonymous'); ?></strong><br>
                                    <span><?php echo esc_html(wp_trim_words(wp_strip_all_tags((string) $row['comment_content']), 40)); ?></span><br>
                                    <?php if (get_edit_comment_link($comment_id)) : ?>
                                        <a href="<?php echo esc_url(get_edit_comment_link($comment_id)); ?>">Edit comment</a>
                                    <?php endif; ?>
                                    <?php if ($post && $post->post_status === 'publish') : ?>
                                        | <a
                                            href="<?php echo esc_url(ws_community_post_url($post) . '#comment-' . $comment_id); ?>"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >View on site</a>
                                    <?php endif; ?>
                                <?php else : ?>
                                    <em>Comment deleted.</em>
                                <?php endif; ?>
                            </td>
                            <td><?php echo esc_html($reporter_name); ?></td>
                            <td><?php echo esc_html(ws_community_report_reason_label((string) $row['reason'])); ?></td>
                            <td>
                                <?php echo !empty($row['details']) ? esc_html((string) $row['details']) : '—'; ?>
                            </td>
                            <td><?php echo esc_html(get_date_from_gmt((string) $row['created_at'], 'M j, Y g:i a')); ?></td>
                            <td>
                                <?php if ($row['status'] === 'pending') : ?>
                                    <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
                                        <input type="hidden" name="action" value="ws_resolve_report">
                                        <input type="hidden" name="report_id" value="<?php echo esc_attr((string) $row['id']); ?>">
                                        <?php wp_nonce_field('ws_report_decision_' . (int) $row['id']); ?>
                                        <button type="submit" name="decision" value="delete" class="button button-small">Delete comment</button>
                                        <button type="submit" name="decision" value="dismiss" class="button button-small">Dismiss</button>
                                    </form>
                                <?php else : ?>
                                    <span><?php echo esc_html(ucfirst((string) $row['status'])); ?></span>
                                    <?php if ($resolver) : ?>
                                        <br><span class="description">
                                            by <?php echo esc_html($resolver->display_name !== '' ? $resolver->display_name : $resolver->user_login); ?>
                                        </span>
                                    <?php endif; ?>
                                <?php endif; ?>
                            </td>
                        </tr>
                    <?php endforeach; ?>
                <?php endif; ?>
            </tbody>
        </table>

        <?php
        $total_pages = max(1, (int) ceil($total / $per_page));
        if ($total_pages > 1) {
            echo '<div class="tablenav"><div class="tablenav-pages">';
            echo wp_kses_post(
                paginate_links([
                    'base'      => $base_url . '&status=' . $status . '&paged=%#%',
                    'format'    => '',
                    'current'   => $paged,
                    'total'     => $total_pages,
                    'prev_text' => '&laquo;',
                    'next_text' => '&raquo;',
                ])
            );
            echo '</div></div>';
        }
        ?>
    </div>
    <?php
}
