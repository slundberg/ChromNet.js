'use strict';

describe('Directive: scalableSeries', function () {

  // load the directive's module
  beforeEach(module('linkClientApp'));

  var element,
    scope;

  beforeEach(inject(function ($rootScope) {
    scope = $rootScope.$new();
  }));

  it('should make hidden element visible', inject(function ($compile) {
    element = angular.element('<scalable-series></scalable-series>');
    element = $compile(element)(scope);
    expect(element.text()).toBe('this is the scalableSeries directive');
  }));
});
