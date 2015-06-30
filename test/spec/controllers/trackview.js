'use strict';

describe('Controller: TrackviewCtrl', function () {

  // load the controller's module
  beforeEach(module('linkClientApp'));

  var TrackviewCtrl,
    scope;

  // Initialize the controller and a mock scope
  beforeEach(inject(function ($controller, $rootScope) {
    scope = $rootScope.$new();
    TrackviewCtrl = $controller('TrackviewCtrl', {
      $scope: scope
    });
  }));

  it('should attach a list of awesomeThings to the scope', function () {
    expect(scope.awesomeThings.length).toBe(3);
  });
});
