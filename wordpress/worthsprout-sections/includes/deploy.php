<?php
/**
 * Cloudflare Pages deploy hook for the headless front end.
 *
 * 前端是 `next build` 全量静态导出的产物，改文章不会自动上线。
 * 这里在内容发布/更新后调用 Pages 的 Deploy Hook 触发一次重建，
 * 并用最小间隔把自动保存、修订版本产生的连续触发合并成一次构建。
 *
 * @package WorthSprout
 */

if (!defined('ABSPATH')) {
    exit;
}

const WS_DEPLOY_HOOK_OPTION = 'ws_deploy_hook_url';
const WS_DEPLOY_INTERVAL_OPTION = 'ws_deploy_min_interval';
const WS_DEPLOY_LAST_OPTION = 'ws_deploy_last_trigger';
const WS_DEPLOY_STATUS_OPTION = 'ws_deploy_last_status';
const WS_DEPLOY_PENDING_OPTION = 'ws_deploy_pending';
const WS_DEPLOY_CRON_HOOK = 'ws_deploy_flush';
const WS_DEPLOY_DEFAULT_INTERVAL = 60;

/** 这些类型的公开变化会改变构建产物 */
function ws_deploy_post_types(): array {
    return apply_filters('ws_deploy_post_types', ['reviews', 'posts']);
}

/** Deploy Hook URL，优先用 wp-config 里的常量 */
function ws_deploy_hook_url(): string {
    if (defined('WS_DEPLOY_HOOK_URL') && is_string(WS_DEPLOY_HOOK_URL)) {
        return esc_url_raw(WS_DEPLOY_HOOK_URL);
    }

    return esc_url_raw((string) get_option(WS_DEPLOY_HOOK_OPTION, ''));
}

/** 两次构建之间的最小间隔（秒），用来合并连点保存 */
function ws_deploy_min_interval(): int {
    $interval = (int) get_option(WS_DEPLOY_INTERVAL_OPTION, WS_DEPLOY_DEFAULT_INTERVAL);
    if ($interval < 0) {
        $interval = 0;
    }

    return (int) apply_filters('ws_deploy_min_interval', $interval);
}

/**
 * 立即请求 Deploy Hook。
 *
 * @param bool $blocking true 时等待响应（后台手动触发用），否则发完就走。
 */
function ws_deploy_send(bool $blocking = false): bool {
    $url = ws_deploy_hook_url();
    if ($url === '') {
        return false;
    }

    $response = wp_remote_post($url, [
        'blocking'   => $blocking,
        'timeout'    => $blocking ? 15 : 0.01,
        'headers'    => ['Content-Type' => 'application/json'],
        'body'       => wp_json_encode([
            'source'     => 'wordpress',
            'triggered'  => gmdate('c'),
            'site'       => home_url('/'),
        ]),
        'user-agent' => 'WorthSprout/' . (defined('WS_VERSION') ? WS_VERSION : '1.0'),
    ]);

    update_option(WS_DEPLOY_LAST_OPTION, time(), false);
    delete_option(WS_DEPLOY_PENDING_OPTION);

    if (is_wp_error($response)) {
        update_option(WS_DEPLOY_STATUS_OPTION, 'error: ' . $response->get_error_message(), false);
        return false;
    }

    if ($blocking) {
        $code = (int) wp_remote_retrieve_response_code($response);
        update_option(WS_DEPLOY_STATUS_OPTION, sprintf('%d @ %s', $code, current_time('mysql')), false);

        return $code >= 200 && $code < 300;
    }

    return true;
}

/** 把本次请求里的多次触发合并到 shutdown 阶段只发一次 */
function ws_deploy_defer_send(): void {
    static $scheduled = false;
    if ($scheduled) {
        return;
    }
    $scheduled = true;

    add_action('shutdown', function (): void {
        ws_deploy_send(false);
    }, 20);
}

/** 超出最小间隔就立刻建，否则记一笔待建并排一个定时任务兜底 */
function ws_deploy_request(): void {
    if (ws_deploy_hook_url() === '') {
        return;
    }

    $interval = ws_deploy_min_interval();
    $last = (int) get_option(WS_DEPLOY_LAST_OPTION, 0);

    if ($interval <= 0 || time() - $last >= $interval) {
        ws_deploy_defer_send();
        return;
    }

    update_option(WS_DEPLOY_PENDING_OPTION, 1, false);

    if (!wp_next_scheduled(WS_DEPLOY_CRON_HOOK)) {
        wp_schedule_single_event($last + $interval, WS_DEPLOY_CRON_HOOK);
    }
}

/** pending 到期就补一次构建（有请求进来时执行，headless 站点也有够用的流量） */
function ws_deploy_flush_pending(): void {
    if (!get_option(WS_DEPLOY_PENDING_OPTION)) {
        return;
    }

    $last = (int) get_option(WS_DEPLOY_LAST_OPTION, 0);
    if (time() - $last < ws_deploy_min_interval()) {
        return;
    }

    ws_deploy_send(false);
}

add_action('transition_post_status', function ($new_status, $old_status, $post): void {
    if (!$post instanceof WP_Post) {
        return;
    }

    // 自动保存、修订版本、自动草稿都不该消耗构建次数
    if (wp_is_post_revision($post) || wp_is_post_autosave($post)) {
        return;
    }

    if (!in_array($post->post_type, ws_deploy_post_types(), true)) {
        return;
    }

    $buildable = ['publish', 'future', 'private'];
    $was_live = in_array($old_status, $buildable, true);
    $is_live = in_array($new_status, $buildable, true);

    // 只在「上线/下线/已发布内容的更新」时重建，草稿之间来回存不触发
    if (!$was_live && !$is_live) {
        return;
    }

    ws_deploy_request();
}, 10, 3);

add_action(WS_DEPLOY_CRON_HOOK, 'ws_deploy_flush_pending');
add_action('wp_loaded', 'ws_deploy_flush_pending');

// 分类名/slug 变化会改到 /category/<slug> 页面，同样需要重建
foreach (['created_review_category', 'edited_review_category', 'delete_review_category'] as $ws_deploy_term_hook) {
    add_action($ws_deploy_term_hook, 'ws_deploy_request');
}

add_action('admin_init', function (): void {
    register_setting('ws_deploy', WS_DEPLOY_HOOK_OPTION, [
        'type'              => 'string',
        'sanitize_callback' => 'esc_url_raw',
        'default'           => '',
    ]);

    register_setting('ws_deploy', WS_DEPLOY_INTERVAL_OPTION, [
        'type'              => 'integer',
        'sanitize_callback' => function ($value): int {
            $interval = (int) $value;

            return $interval >= 0 ? $interval : WS_DEPLOY_DEFAULT_INTERVAL;
        },
        'default'           => WS_DEPLOY_DEFAULT_INTERVAL,
    ]);
});

add_action('admin_menu', function (): void {
    add_options_page(
        'WorthSprout Deploy',
        'WorthSprout Deploy',
        'manage_options',
        'worthsprout-deploy',
        'ws_deploy_render_page'
    );
});

add_action('admin_post_ws_deploy_now', function (): void {
    if (!current_user_can('manage_options')) {
        wp_die('Sorry, you are not allowed to do that.');
    }

    check_admin_referer('ws_deploy_now');

    $ok = ws_deploy_send(true);

    wp_safe_redirect(add_query_arg([
        'page'            => 'worthsprout-deploy',
        'ws_deploy_result' => $ok ? 'ok' : 'fail',
    ], admin_url('options-general.php')));
    exit;
});

function ws_deploy_render_page(): void {
    if (!current_user_can('manage_options')) {
        return;
    }

    $last = (int) get_option(WS_DEPLOY_LAST_OPTION, 0);
    $status = (string) get_option(WS_DEPLOY_STATUS_OPTION, '');
    $pending = (bool) get_option(WS_DEPLOY_PENDING_OPTION, false);
    $result = isset($_GET['ws_deploy_result']) ? sanitize_key(wp_unslash($_GET['ws_deploy_result'])) : '';
    $using_constant = defined('WS_DEPLOY_HOOK_URL');
    ?>
    <div class="wrap">
        <h1>WorthSprout Deploy</h1>

        <?php if ($result === 'ok') : ?>
            <div class="notice notice-success is-dismissible"><p>已触发 Cloudflare Pages 构建。</p></div>
        <?php elseif ($result === 'fail') : ?>
            <div class="notice notice-error is-dismissible"><p>触发失败，状态见下方“上次结果”。</p></div>
        <?php endif; ?>

        <?php if ($using_constant) : ?>
            <div class="notice notice-info"><p>已在 <code>wp-config.php</code> 中通过 <code>WS_DEPLOY_HOOK_URL</code> 定义，下面填写不生效。</p></div>
        <?php endif; ?>

        <p>
            前端是全量静态导出的站点，文章保存后需要重新构建才会出现在线上。
            在 Cloudflare 后台 <strong>Workers &amp; Pages → 你的项目 → Settings → Builds → Add deploy hook</strong>
            生成的 URL 填在下面即可。
        </p>

        <form method="post" action="options.php">
            <?php settings_fields('ws_deploy'); ?>
            <table class="form-table" role="presentation">
                <tr>
                    <th scope="row"><label for="ws-deploy-hook">Deploy Hook URL</label></th>
                    <td>
                        <input type="url" id="ws-deploy-hook" class="regular-text code"
                               name="<?php echo esc_attr(WS_DEPLOY_HOOK_OPTION); ?>"
                               value="<?php echo esc_attr((string) get_option(WS_DEPLOY_HOOK_OPTION, '')); ?>"
                               placeholder="https://api.cloudflare.com/client/v4/pages/webhooks/deploy_hooks/...">
                    </td>
                </tr>
                <tr>
                    <th scope="row"><label for="ws-deploy-interval">最小构建间隔（秒）</label></th>
                    <td>
                        <input type="number" id="ws-deploy-interval" min="0" step="10" class="small-text"
                               name="<?php echo esc_attr(WS_DEPLOY_INTERVAL_OPTION); ?>"
                               value="<?php echo esc_attr((string) get_option(WS_DEPLOY_INTERVAL_OPTION, WS_DEPLOY_DEFAULT_INTERVAL)); ?>">
                        <p class="description">间隔内的多次保存只会在该间隔结束后补一次构建，用来合并自动保存产生的重复触发。填 0 表示每次都立刻构建。</p>
                    </td>
                </tr>
            </table>
            <?php submit_button('保存设置'); ?>
        </form>

        <h2>状态</h2>
        <p>
            上次触发：<?php echo $last ? esc_html(wp_date('Y-m-d H:i:s', $last)) : '从未'; ?><br>
            上次结果：<?php echo $status !== '' ? esc_html($status) : '—'; ?><br>
            待补构建：<?php echo $pending ? '有（间隔结束后自动补一次）' : '无'; ?>
        </p>

        <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
            <?php wp_nonce_field('ws_deploy_now'); ?>
            <input type="hidden" name="action" value="ws_deploy_now">
            <?php submit_button('立即重新构建', 'secondary', 'submit', false); ?>
        </form>
    </div>
    <?php
}
