<?php
/**
 * Plugin Name: WorthSprout Sections
 * Description: Repeatable product sections for the reviews post type, exposed to the WP REST API. Also triggers a Cloudflare Pages rebuild when content changes.
 * Version: 1.6.1
 * Requires at least: 6.0
 * Requires PHP: 7.4
 */

if (!defined('ABSPATH')) {
    exit;
}

define('WS_VERSION', '1.6.1');

const WS_SECTIONS_META_KEY = '_ws_sections';
const WS_SECTIONS_NONCE = 'ws_sections_nonce';

require_once __DIR__ . '/includes/deploy.php';
require_once __DIR__ . '/includes/community.php';

add_action('add_meta_boxes', function () {
    add_meta_box(
        'ws_sections',
        'Sections & products',
        'ws_render_sections_meta_box',
        'reviews',
        'normal',
        'high'
    );
});

function ws_sections_default_row(): array {
    return [
        'section_heading' => '',
        'anchor'          => '',
        'label'           => '',
        'product_name'    => '',
        'rating'          => '',
        'pros'            => '',
        'cons'            => '',
        'image'           => '',
        'price'           => '',
        'affiliate_link'  => '',
        'specs'           => '',
        'features'        => '',
    ];
}

function ws_get_sections(int $post_id): array {
    $rows = get_post_meta($post_id, WS_SECTIONS_META_KEY, true);
    if (!is_array($rows)) {
        return [];
    }

    return array_values(array_filter($rows, 'is_array'));
}

/**
 * 后台表单和 REST 写入共用的清洗逻辑，保证两条路径存出的结构一致。
 */
function ws_sanitize_section_rows($rows): array {
    if (!is_array($rows)) {
        return [];
    }

    $clean_rows = [];

    foreach ($rows as $row) {
        if (!is_array($row)) {
            continue;
        }

        $clean = [
            'section_heading' => sanitize_text_field((string) ($row['section_heading'] ?? '')),
            'anchor'          => sanitize_title((string) ($row['anchor'] ?? '')),
            'label'           => sanitize_text_field((string) ($row['label'] ?? '')),
            'product_name'    => sanitize_text_field((string) ($row['product_name'] ?? '')),
            'rating'          => sanitize_text_field((string) ($row['rating'] ?? '')),
            'pros'            => sanitize_textarea_field((string) ($row['pros'] ?? '')),
            'cons'            => sanitize_textarea_field((string) ($row['cons'] ?? '')),
            'image'           => esc_url_raw((string) ($row['image'] ?? '')),
            'price'           => sanitize_text_field((string) ($row['price'] ?? '')),
            'affiliate_link'  => esc_url_raw((string) ($row['affiliate_link'] ?? '')),
            // 对比表用：每行一个 `Label: value`
            'specs'           => sanitize_textarea_field((string) ($row['specs'] ?? '')),
            // 对比表用：每行一个 `Feature name | yes|no|partial`
            'features'        => sanitize_textarea_field((string) ($row['features'] ?? '')),
        ];

        if (implode('', $clean) === '') {
            continue;
        }

        $clean_rows[] = $clean;
    }

    return $clean_rows;
}

function ws_render_section_row($index, array $row): void {
    $name = 'ws_sections[' . $index . ']';
    $fields = array_merge(ws_sections_default_row(), $row);
    ?>
    <div class="ws-section-row">
        <div class="ws-section-head">
            <span class="ws-drag-handle" title="Drag to reorder">⋮⋮</span>
            <strong>Section <span class="ws-section-number"></span></strong>
            <button type="button" class="button-link ws-remove-section">Remove</button>
        </div>

        <div class="ws-section-grid">
            <label>
                <span>Section heading (H2 text)</span>
                <input type="text" name="<?php echo esc_attr($name); ?>[section_heading]" value="<?php echo esc_attr($fields['section_heading']); ?>" placeholder="Long-term Comfort">
            </label>

            <label>
                <span>H2 anchor (optional)</span>
                <input type="text" name="<?php echo esc_attr($name); ?>[anchor]" value="<?php echo esc_attr($fields['anchor']); ?>" placeholder="long-term-comfort">
            </label>

            <label>
                <span>Card label</span>
                <input type="text" name="<?php echo esc_attr($name); ?>[label]" value="<?php echo esc_attr($fields['label']); ?>" placeholder="Best overall">
            </label>

            <label>
                <span>Product name</span>
                <input type="text" name="<?php echo esc_attr($name); ?>[product_name]" value="<?php echo esc_attr($fields['product_name']); ?>">
            </label>

            <label>
                <span>Rating (0-10)</span>
                <input type="text" name="<?php echo esc_attr($name); ?>[rating]" value="<?php echo esc_attr($fields['rating']); ?>" placeholder="9.2">
            </label>

            <label>
                <span>Price</span>
                <input type="text" name="<?php echo esc_attr($name); ?>[price]" value="<?php echo esc_attr($fields['price']); ?>" placeholder="1399">
            </label>

            <label class="ws-span-2">
                <span>Pros</span>
                <textarea name="<?php echo esc_attr($name); ?>[pros]" rows="2"><?php echo esc_textarea($fields['pros']); ?></textarea>
            </label>

            <label class="ws-span-2">
                <span>Cons</span>
                <textarea name="<?php echo esc_attr($name); ?>[cons]" rows="2"><?php echo esc_textarea($fields['cons']); ?></textarea>
            </label>

            <label class="ws-span-2 ws-image-field">
                <span>Image URL</span>
                <span class="ws-image-controls">
                    <input type="text" name="<?php echo esc_attr($name); ?>[image]" value="<?php echo esc_url($fields['image']); ?>" placeholder="https://...">
                    <button type="button" class="button ws-select-image">Select image</button>
                </span>
            </label>

            <label class="ws-span-2">
                <span>Affiliate URL</span>
                <input type="text" name="<?php echo esc_attr($name); ?>[affiliate_link]" value="<?php echo esc_url($fields['affiliate_link']); ?>" placeholder="https://...">
            </label>

            <label class="ws-span-2">
                <span>Key specs (one per line, "Label: value")</span>
                <textarea name="<?php echo esc_attr($name); ?>[specs]" rows="4" placeholder="Platforms: iOS, Android, web&#10;Household: Up to 6 people&#10;Documents: Photo + AI OCR"><?php echo esc_textarea($fields['specs']); ?></textarea>
            </label>

            <label class="ws-span-2">
                <span>Features (one per line, "Feature | yes / no / partial")</span>
                <textarea name="<?php echo esc_attr($name); ?>[features]" rows="4" placeholder="Shared tasks | yes&#10;Offline mode | no&#10;Clinic integration | partial"><?php echo esc_textarea($fields['features']); ?></textarea>
            </label>
        </div>
    </div>
    <?php
}

function ws_render_sections_meta_box($post): void {
    wp_nonce_field('ws_sections_save', WS_SECTIONS_NONCE);

    $rows = ws_get_sections((int) $post->ID);
    if (empty($rows)) {
        $rows = [ws_sections_default_row()];
    }
    ?>
    <style>
        #ws-sections { margin: 8px 0 16px; }
        #ws-sections-rows { display: block; }
        .ws-section-row { border: 1px solid #dcdcde; border-radius: 6px; background: #fff; margin-bottom: 12px; }
        .ws-section-head { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-bottom: 1px solid #f0f0f1; background: #f6f7f7; }
        .ws-section-head strong { flex: 1; }
        .ws-drag-handle { cursor: grab; color: #8c8f94; font-size: 16px; line-height: 1; }
        .ws-remove-section { color: #b32d2e; }
        .ws-section-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 14px; padding: 12px; }
        .ws-section-grid label { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
        .ws-section-grid label > span { font-weight: 600; color: #1d2327; }
        .ws-section-grid input[type="text"], .ws-section-grid textarea { width: 100%; }
        .ws-span-2 { grid-column: 1 / -1; }
        .ws-image-controls { display: flex; gap: 8px; }
        .ws-image-controls input { flex: 1; }
        @media (max-width: 782px) { .ws-section-grid { grid-template-columns: 1fr; } }
    </style>

    <div id="ws-sections">
        <p class="description">
            One row per article section. The card is inserted after the H2 whose text or anchor matches
            "Section heading" / "H2 anchor".
        </p>

        <div id="ws-sections-rows">
            <?php foreach ($rows as $index => $row) {
                ws_render_section_row($index, $row);
            } ?>
        </div>

        <p>
            <button type="button" class="button button-primary" id="ws-add-section">Add section</button>
        </p>

        <script type="text/html" id="ws-section-template">
            <?php ws_render_section_row('__INDEX__', ws_sections_default_row()); ?>
        </script>
    </div>
    <?php
}

add_action('save_post_reviews', function (int $post_id) {
    if (!isset($_POST[WS_SECTIONS_NONCE]) || !wp_verify_nonce(sanitize_text_field(wp_unslash($_POST[WS_SECTIONS_NONCE])), 'ws_sections_save')) {
        return;
    }

    if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) {
        return;
    }

    if (!current_user_can('edit_post', $post_id)) {
        return;
    }

    $rows = [];
    if (isset($_POST['ws_sections']) && is_array($_POST['ws_sections'])) {
        $rows = ws_sanitize_section_rows(wp_unslash($_POST['ws_sections']));
    }

    if (!empty($rows)) {
        update_post_meta($post_id, WS_SECTIONS_META_KEY, $rows);
    } else {
        delete_post_meta($post_id, WS_SECTIONS_META_KEY);
    }
});

add_action('admin_enqueue_scripts', function (string $hook): void {
    if (!in_array($hook, ['post.php', 'post-new.php'], true)) {
        return;
    }

    $screen = get_current_screen();
    if (!$screen || $screen->post_type !== 'reviews') {
        return;
    }

    wp_enqueue_media();
    wp_enqueue_script(
        'worthsprout-sections',
        plugins_url('assets/sections.js', __FILE__),
        ['jquery', 'jquery-ui-sortable'],
        WS_VERSION,
        true
    );
});

// 可读可写：`ws_sections` 同时出现在 POST 参数里，脚本化发布可直接带上产品卡片。
// 注意 `reviews` 没开 custom-fields 支持，走 `meta._ws_sections` 写不进去，写入口只能挂 update_callback。
add_action('rest_api_init', function () {
    register_rest_field('reviews', 'ws_sections', [
        'get_callback' => function ($post) {
            $rows = ws_get_sections((int) $post['id']);

            return array_map(function (array $row): array {
                $image = $row['image'] ?? '';

                if (is_numeric($image)) {
                    $image = wp_get_attachment_image_url((int) $image, 'full');
                }

                return [
                    'section_heading' => $row['section_heading'] ?? '',
                    'anchor'          => $row['anchor'] ?? '',
                    'label'           => $row['label'] ?? '',
                    'product_name'    => $row['product_name'] ?? '',
                    'rating'          => $row['rating'] ?? '',
                    'pros'            => $row['pros'] ?? '',
                    'cons'            => $row['cons'] ?? '',
                    'image'           => $image ?: '',
                    'price'           => $row['price'] ?? '',
                    'affiliate_link'  => $row['affiliate_link'] ?? '',
                    'specs'           => $row['specs'] ?? '',
                    'features'        => $row['features'] ?? '',
                ];
            }, $rows);
        },
        'update_callback' => function ($value, $post) {
            if (!$post instanceof WP_Post) {
                return new WP_Error('ws_sections_invalid', 'Invalid post object.', ['status' => 400]);
            }

            if (!current_user_can('edit_post', $post->ID)) {
                return new WP_Error('ws_sections_forbidden', 'You are not allowed to edit this post.', ['status' => 403]);
            }

            $rows = ws_sanitize_section_rows($value);

            if (empty($rows)) {
                delete_post_meta($post->ID, WS_SECTIONS_META_KEY);
                return true;
            }

            update_post_meta($post->ID, WS_SECTIONS_META_KEY, $rows);

            return true;
        },
        'schema' => [
            'type'  => 'array',
            'items' => [
                'type'       => 'object',
                'properties' => [
                    'section_heading' => ['type' => 'string'],
                    'anchor'          => ['type' => 'string'],
                    'label'           => ['type' => 'string'],
                    'product_name'    => ['type' => 'string'],
                    'rating'          => ['type' => 'string'],
                    'pros'            => ['type' => 'string'],
                    'cons'            => ['type' => 'string'],
                    'image'           => ['type' => 'string'],
                    'price'           => ['type' => 'string'],
                    'affiliate_link'  => ['type' => 'string'],
                    'specs'           => ['type' => 'string'],
                    'features'        => ['type' => 'string'],
                ],
            ],
        ],
    ]);
});
