'use strict';

/**
 * @ngdoc overview
 * @name linkClientApp
 * @description
 * # linkClientApp
 *
 * Main module of the application.
 */
angular
  .module('linkClientApp', [
    'ngAnimate',
    'ngResource',
    'ngRoute',
    'ngSanitize',
    'ngTouch'
  ])
  .config(function ($routeProvider) {
    $routeProvider
      .when('/', {
        templateUrl: 'views/main.html',
        controller: 'MainCtrl',
        reloadOnSearch: false
      })
      .when('/about', {
        templateUrl: 'views/about.html',
        controller: 'AboutCtrl'
      })
      .when('/trackview', {
        templateUrl: 'views/trackview.html',
        controller: 'TrackviewCtrl'
      })
      .otherwise({
        redirectTo: '/'
      });
  });
