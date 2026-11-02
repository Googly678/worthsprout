(function ($) {
    "use strict";

    $(function () {
        var $rows = $("#ws-sections-rows");
        if (!$rows.length) {
            return;
        }

        var nextIndex = $rows.find(".ws-section-row").length;

        function reindex() {
            $rows.find(".ws-section-row").each(function (rowIndex) {
                $(this).find('[name^="ws_sections["]').each(function () {
                    this.name = this.name.replace(/^ws_sections\[[^\]]*\]/, "ws_sections[" + rowIndex + "]");
                });
                $(this).find(".ws-section-number").text(rowIndex + 1);
            });
            nextIndex = $rows.find(".ws-section-row").length;
        }

        $("#ws-add-section").on("click", function () {
            var template = $("#ws-section-template").html().replace(/__INDEX__/g, String(nextIndex));
            $rows.append(template);
            reindex();
        });

        $rows.on("click", ".ws-remove-section", function () {
            $(this).closest(".ws-section-row").remove();
            reindex();
        });

        $rows.on("click", ".ws-select-image", function (event) {
            event.preventDefault();

            if (typeof wp === "undefined" || !wp.media) {
                return;
            }

            var $input = $(this).closest(".ws-image-field").find('input[type="text"]');
            var frame = wp.media({
                title: "Select product image",
                button: { text: "Use image" },
                multiple: false
            });

            frame.on("select", function () {
                var attachment = frame.state().get("selection").first().toJSON();
                $input.val(attachment.url);
            });

            frame.open();
        });

        if ($.fn.sortable) {
            $rows.sortable({
                handle: ".ws-drag-handle",
                axis: "y",
                update: reindex
            });
        }

        reindex();
    });
})(jQuery);
