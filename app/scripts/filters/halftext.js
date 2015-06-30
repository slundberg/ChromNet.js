'use strict';

/**
 * @ngdoc filter
 * @name linkClientApp.filter:halftext
 * @function
 * @description
 * # halftext
 * Filter in the linkClientApp.
 */
angular.module('linkClientApp').filter('halftext', function () {
	return function (input) {
		if (!input) return "";
		return input.substr(0, Math.min(input.length-1, Math.floor(input.length/2)+2));
    };
});
