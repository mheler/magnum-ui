/**
 * Licensed under the Apache License, Version 2.0 (the "License"); you may
 * not use self file except in compliance with the License. You may obtain
 * a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations
 * under the License.
 */

(function() {
  'use strict';

  angular
    .module('horizon.dashboard.container-infra.quotas')
    .factory('horizon.dashboard.container-infra.quotas.delete.service', deleteService);

  deleteService.$inject = [
    '$location',
    '$q',
    '$rootScope',
    'horizon.app.core.openstack-service-api.magnum',
    'horizon.app.core.openstack-service-api.policy',
    'horizon.framework.util.actions.action-result.service',
    'horizon.framework.util.i18n.gettext',
    'horizon.framework.util.q.extensions',
    'horizon.framework.widgets.modal.deleteModalService',
    'horizon.framework.widgets.table.events',
    'horizon.framework.widgets.toast.service',
    'horizon.dashboard.container-infra.quotas.resourceType',
    'horizon.dashboard.container-infra.quotas.events'
  ];

  /**
   * @ngDoc factory
   * @name quotas.delete.service
   * @param {Object} $location
   * @param {Object} $q
   * @param {Object} magnum
   * @param {Object} policy
   * @param {Object} actionResult
   * @param {Object} gettext
   * @param {Object} $qExtensions
   * @param {Object} deleteModal
   * @param {Object} toast
   * @param {Object} resourceType
   * @param {Object} events
   * @returns {Object} delete service
   * @description
   * Brings up the delete quotas confirmation modal dialog.
   * On submit, delete selected resources.
   * On cancel, do nothing.
   */
  function deleteService(
    $location, $q, $rootScope, magnum, policy, actionResult, gettext, $qExtensions,
    deleteModal, tableEvents, toast, resourceType, events
  ) {
    var scope;
    var context = {
      labels: null,
      deleteEntity: deleteEntity,
      successEvent: events.DELETE_SUCCESS
    };
    var service = {
      initAction: initAction,
      allowed: allowed,
      perform: perform
    };
    var notAllowedMessage = gettext("You are not allowed to delete quotas: %s");

    return service;

    //////////////

    // include this function in your service
    // if you plan to emit events to the parent controller
    function initAction() {
    }

    function allowed() {
      return $qExtensions.booleanAsPromise(true);
    }

    // delete selected resource objects
    function perform(selected, $scope) {
      scope = $scope;
      selected = angular.isArray(selected) ? selected : [selected];
      context.labels = labelize(selected.length);
      return $qExtensions.allSettled(selected.map(checkPermission)).then(afterCheck);
    }

    function labelize(count) {
      return {
        title: ngettext('Confirm Delete Quota',
                        'Confirm Delete Quotas', count),
        /* eslint-disable max-len */
        message: ngettext('You have selected "%s". Please confirm your selection. Deleted quota is not recoverable.',
                          'You have selected "%s". Please confirm your selection. Deleted quotas are not recoverable.', count),
        /* eslint-enable max-len */
        submit: ngettext('Delete Quota',
                         'Delete Quotas', count),
        success: ngettext('Deleted quota: %s.',
                          'Deleted quotas: %s.', count),
        error: ngettext('Unable to delete quota: %s.',
                        'Unable to delete quotas: %s.', count)
      };
    }

    // for batch delete
    function checkPermission(selected) {
      return {promise: allowed(selected), context: selected};
    }

    // for batch delete
    function afterCheck(result) {
      var outcome = $q.reject();  // Reject the promise by default
      if (result.fail.length > 0) {
        toast.add('error', getMessage(notAllowedMessage, result.fail));
        outcome = $q.reject(result.fail);
      }
      if (result.pass.length > 0) {
        outcome = deleteModal.open(scope, result.pass.map(getEntity), context).then(createResult);
      }
      return outcome;
    }

    function createResult(deleteModalResult) {
      // To make the result of this action generically useful, reformat the return
      // from the deleteModal into a standard form
      var result = actionResult.getActionResult();
      deleteModalResult.pass.forEach(function markDeleted(item) {
        result.deleted(resourceType, getEntity(item).project_id + "/" + getEntity(item).resource);
      });
      deleteModalResult.fail.forEach(function markFailed(item) {
        result.failed(resourceType, getEntity(item).project_id + "/" + getEntity(item).resource);
      });
      var indexPath = "/admin/container_infra/quotas";
      var currentPath = $location.path();
      if (result.result.failed.length === 0 && result.result.deleted.length > 0 &&
          currentPath !== indexPath) {
        $location.path(indexPath);
      } else {
        $rootScope.$broadcast(tableEvents.CLEAR_SELECTIONS);
        return result.result;
      }
    }

    function getMessage(message, entities) {
      return interpolate(message, [entities.map(getName).join(", ")]);
    }

    function getName(result) {
      return getEntity(result).project_id + "/" + getEntity(result).resource;
    }

    // for batch delete
    function getEntity(result) {
      return result.context;
    }

    // call delete REST API
    function deleteEntity(id, item) {
      return magnum.deleteQuota(item.project_id, item.resource, false);
    }
  }
})();
