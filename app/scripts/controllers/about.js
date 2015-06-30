'use strict';

/**
 * @ngdoc function
 * @name linkClientApp.controller:AboutCtrl
 * @description
 * # AboutCtrl
 * Controller of the linkClientApp
 */
angular.module('linkClientApp')
  .controller('AboutCtrl', function ($scope) {
    $scope.awesomeThings = [
      'HTML5 Boilerplate',
      'AngularJS',
      'Karma'
    ];
  });
