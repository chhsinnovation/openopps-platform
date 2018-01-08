var $ = require('jquery');
var _ = require('underscore');
var async = require('async');
var Bootstrap = require('bootstrap');
var Backbone = require('backbone');
var i18n = require('i18next');
var i18nextJquery = require('jquery-i18next');
var marked = require('marked');
var TimeAgo = require('../../../../../vendor/jquery.timeago');

var BaseView = require('../../../../base/base_view');
var UIConfig = require('../../../../config/ui.json');

var TaskShowTemplate = require('../templates/task_show_item_template.html');
var AlertTemplate = require('../../../../components/alert_template.html');
var ShareTemplate = require('../templates/task_share_template.txt');


var TaskItemView = BaseView.extend({
  initialize: function (options) {
    var self = this;
    this.options = options;
    this.model.trigger('task:model:fetch', options.id);
    this.listenTo(this.model, 'task:model:fetch:success', function (model) {
      self.model = model;
      self.initializeTags(self);
    });
    this.listenTo(this.model, 'task:model:fetch:error', function (model, xhr) {
      var template = _.template(AlertTemplate)();
      self.$el.html(template);
    });
  },

  render: function (self) {
    var taskState = self.model.attributes.state;

    if (_.isString(taskState)) {
      taskState = taskState.charAt(0).toUpperCase() + taskState.slice(1);
    }

    self.data = {
      user: window.cache.currentUser,
      model: self.model.toJSON(),
      tags: self.model.toJSON().tags,
      state: {
        humanReadable: taskState,
        value: taskState.toLowerCase(),
      },
    };

    self.data['madlibTags'] = organizeTags(self.data.tags);
    self.data.model.descriptionHtml = marked(self.data.model.description || '');
    self.model.trigger('task:tag:data', self.tags, self.data['madlibTags']);

    var d = self.data,
        vol = ((!d.user || d.user.id !== d.model.userId) &&
        (d.model.volunteer || 'open' === d.model.state));

    self.data.ui = UIConfig;
    self.data.vol = vol;
    self.data.model.userId = self.data.model.owner.id; 
    var compiledTemplate = _.template(TaskShowTemplate)(self.data);

    self.$el.html(compiledTemplate);
    self.$el.localize();
    $('time.timeago').timeago();
    self.updateTaskEmail();
    self.model.trigger('task:show:render:done');

    if ('?volunteer' === window.location.search && !self.model.attributes.volunteer) {
      $('#volunteer').click();

      Backbone.history.navigate(window.location.pathname, {
        trigger: false,
        replace: true,
      });
    }
  },

  updateTaskEmail: function () {
    var subject = 'Take A Look At This Opportunity',
        data = {
          opportunityTitle: this.model.get('title'),
          opportunityLink: window.location.protocol +
          '//' + window.location.host + '' + window.location.pathname,
          opportunityDescription: this.model.get('description'),
          opportunityMadlibs: $('<div />', {
            html: this.$('#task-show-madlib-description').html(),
          }).text().replace(/\s+/g, ' '),
        },
        body = _.template(ShareTemplate)(data),
        link = 'mailto:?subject=' + encodeURIComponent(subject) +
      '&body=' + encodeURIComponent(body);

    this.$('#email').attr('href', link);
  },

  initializeTags: function (self) {
    var types = ['task-skills-required', 'task-time-required', 'task-people', 'task-length', 'task-time-estimate'];

    self.tagSources = {};

    var requestAllTagsByType = function (type, cb) {
      $.ajax({
        url: '/api/ac/tag?type=' + type + '&list',
        type: 'GET',
        async: false,
        success: function (data) {
          self.tagSources[type] = data;
          return cb();
        },
      });
    };

    async.each(types, requestAllTagsByType, function (err) {
      self.model.trigger('task:tag:types', self.tagSources);
      self.render(self);
    });
  },

  cleanup: function () {
    removeView(this);
  },
});

module.exports = TaskItemView;
