'use strict';

/**
 * @ngdoc function
 * @name linkClientApp.controller:TrackviewCtrl
 * @description
 * # TrackviewCtrl
 * Controller of the linkClientApp
 */
angular.module('linkClientApp')
  .controller('TrackviewCtrl', function ($scope) {
    $scope.awesomeThings = [
      'HTML5 Boilerplate',
      'AngularJS',
      'Karma'
    ];

    $scope.sharedZoom = {};
  });
