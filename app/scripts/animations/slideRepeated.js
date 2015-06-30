'use strict';

angular.module('linkClientApp').animation('.slide-repeated', function() { return {
    enter: function(element, done) {
        var height = element.height();
        element.css('height', 0);
        $(element).animate({
            height: height,
            duration: 2000
        }, function(args) {
            element.css('height', 'auto');
            done(args);
        });

        return function(isCancelled) {
            if (isCancelled) $(element).stop();
        };
    },
    leave : function(element, done) {
        element.css('height', element.height());
        $(element).animate({
            height: 0
        }, done);

        return function(isCancelled) {
            if (isCancelled) $(element).stop();
        };
    },
    move : function(element, done) { // This still needs to be implemented
        element.css('opacity', 0);
        $(element).animate({
            opacity: 1
        }, done);

        return function(isCancelled) {
            if (isCancelled) $(element).stop();
        };
    }
};});