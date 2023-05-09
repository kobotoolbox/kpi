/* FORK from https://gist.github.com/abyx/1017597 */
window.addEventListener("load", function() {
  (function ($) {
    ListFilterCollapsePrototype = {
      bindToggle: function () {
        const that = this;
        this.$filterTitle.click(function (e) {
          e.preventDefault();
          const hidden = that.$list.hasClass('filtered');
          that._toggleFilterPanel(hidden);
        });
      },
      init: function (filterEl) {
        this.$filterTitle = $(filterEl).children('h2');
        this.$filterContent = $(filterEl).children('h3, ul');
        $(this.$filterTitle).css('cursor', 'pointer');
        $(this.$filterTitle).text($(this.$filterTitle).text() + ' >>');
        this.$list = $('#changelist');
        this.$filterContainer = $('#changelist-filter');
        this.bindToggle();

        const toggleStatus = localStorage.getItem('django-admin-filter');
        if (toggleStatus === 'hidden') {
          this._toggleFilterPanel(true);
        }
      },
      _toggleFilterPanel: function(hidden) {
        if (hidden) {
            $(this.$filterTitle).text('<<');
            this.$filterContent.hide();
            localStorage.setItem('django-admin-filter', 'hidden');
            this.$filterContainer.css({'flex-basis': 'auto'});
          } else {
            $(this.$filterTitle).text('FILTER >>');
            this.$filterContent.show();
            localStorage.removeItem('django-admin-filter');
            this.$filterContainer.css({'flex-basis': '200px'});
          }
          this.$list.toggleClass('filtered');
      },
    };

    function ListFilterCollapse(filterEl) {
      this.init(filterEl);
    }

    ListFilterCollapse.prototype = ListFilterCollapsePrototype;

    $(document).ready(function ($) {
      $('#changelist-filter').each(function () {
        const collapser = new ListFilterCollapse(this);
      });
    });
  })(django.jQuery);
});
