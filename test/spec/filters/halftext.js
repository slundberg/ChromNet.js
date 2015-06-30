'use strict';

describe('Filter: halftext', function () {

  // load the filter's module
  beforeEach(module('linkClientApp'));

  // initialize a new instance of the filter before each test
  var halftext;
  beforeEach(inject(function ($filter) {
    halftext = $filter('halftext');
  }));

  it('should return the input prefixed with "halftext filter:"', function () {
    var text = 'angularjs';
    expect(halftext(text)).toBe('halftext filter: ' + text);
  });

});
