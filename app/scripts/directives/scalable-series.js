'use strict';

/**
 * @ngdoc directive
 * @name linkClientApp.directive:scalableSeries
 * @description
 * # scalableSeries
 */
angular.module('linkClientApp').directive('scalableSeries', function ($http) { return {
	template: '<div><div class="scalable-series-paddingDiv"></div><canvas class="scalable-series-canvas"></canvas><svg class="no-select" style="position: relative; width: 100%; height: 100%"></svg></div>',
	restrict: 'E',
    replace: true,
    'scope': {
        view: '=',
        track: '@',
        color: '@',
        hideXAxis: '@',
        height: '@'
    },
	link: function postLink(scope, element) {
		var marginBottom = 20;
		var svgElement = d3.select($(element).find('svg')[0]);
        var svg = svgElement.append("g").attr("user-select", "none");
        var canvas = d3.select($(element).find('canvas')[0]);
        var context = canvas[0][0].getContext("2d");

        var storageRoot = "http://storage.googleapis.com/link-uw-tracks/";
        var xmin = 0;
        var xmax = 40000000;
        var minLevel = 6;
        var maxLevel = 12;
        var view = scope.view;
        var trackLoaded = false;
        var marginTop, canvasWidth, canvasHeight;

        // make sure we have a common view created
        if (view === undefined) view = {};
        if (!view.updateFunctions) {
            view.updateFunctions = [];
            view.resetZoomFunctions = [];
            
            view.resetZoom = function() {
                for (var i = 0; i < view.resetZoomFunctions.length; ++i) {
                    view.resetZoomFunctions[i]();
                }
            };
            view.resetZoomThrottled = _.throttle(function() {
                if (!view.zoomRunning) view.resetZoom();
            }, 1000);
            view.resetZoomLazy = _.debounce(function() {
                if (!view.zoomRunning) view.resetZoom();
            }, 5000);
            view.scrollXOffset = 0;
            view.savedScale = 1;
            view.numOpen = 0;

            // Fix the zoom extents
            view.fixZoom = function() {
                var d = view.xScale.domain();
                if (d[1]-d[0] > xmax-xmin) {
                    view.zoom.scale(view.zoom.scale() * ((d[1]-d[0])/(xmax-xmin)));
                }
                if (d[0] < xmin) {
                    view.zoom.translate([view.zoom.translate()[0] - view.xScale(xmin) + view.xScale.range()[0], 0]);
                } else if (d[1] > xmax) {
                    view.zoom.translate([view.zoom.translate()[0] - view.xScale(xmax) + view.xScale.range()[1], 0]);
                }
            };

            view.doZoom = function() {

                // if we are scrolling horizontally then we interpret that as panning (something d3 does not do for us)
                if (view.scrollXOffset !== undefined || Math.abs(d3.event.sourceEvent.wheelDeltaX) > Math.abs(2*d3.event.sourceEvent.wheelDeltaY)) {
                    if (view.scrollXOffset === undefined) {
                        view.scrollXOffset = 0;
                        view.savedScale = view.zoom.scale();
                    }
                    view.scrollXOffset += d3.event.sourceEvent.wheelDeltaX;

                    // override d3 during horizontal scrolling
                    view.zoom.translate([view.scrollXOffset, 0]); 
                    view.zoom.scale(view.savedScale);
                }
                
                view.fixZoom();

                // call all the update functions
                for (var i = 0; i < view.updateFunctions.length; ++i) {
                    view.updateFunctions[i]();
                }
            };
            view.xScale = d3.scale.linear()
                .domain([100000, 200000]);
            view.zoom = d3.behavior.zoom()
                .x(view.xScale)
                .on('zoomstart', function() { view.zoomRunning = true; view.numOpen += 1; view.scrollXOffset = undefined; })
                .on('zoom', view.doZoom)
                .on('zoomend', function() {
                    view.zoomRunning = false; 
                    // When horiz scrolling we need to force through our changes before d3 overwrites them
                    // (this is okay for touch events which end infrequently)
                    if (view.scrollXOffset !== undefined) {
                        view.zoom.translate([view.scrollXOffset, 0]);
                        view.zoom.scale(view.savedScale);
                        view.fixZoom();
                        view.scrollXOffset = undefined; // mark that we are done with horiz scrolling
                        view.resetZoom();
                    } else {
                        view.resetZoomThrottled();
                    }
                });
        }

        var yScale = d3.scale.linear().domain([0, 100]);

        var commasFormatter = d3.format(",.0f");
        var xAxis = d3.svg.axis()
            .scale(view.xScale)
            .tickSize(0)
            .outerTickSize(0)
            .tickFormat(function(d) { return scope.hideXAxis === "true" ? "" : commasFormatter(d); })
            .orient("top");
        
        var yAxis = d3.svg.axis()
            .scale(yScale)
            .ticks(3)
            .tickFormat(function(d) { return d === 0 ? "" : commasFormatter(d); })
            .orient("left");

        var resetZoom = function() {
            view.zoom.x(view.xScale);
            xOffset = 0;
            if (displayData.length > 0) drawCanvas();
        };
        view.resetZoomFunctions.push(resetZoom);

        var dataCache = _.object(_.map(_.range(20), function(i) { return [i, {}]; }));
        var displayData = [];
        var xOffset = 0;
        var updateDisplayData = _.throttle(function() {
            displayData = [];
            if (addChunks(displayData, view.xScale.domain(), currZoomLevel)) {
                if (displayData.length > 0) {
                    if (view.zoom.scale() !== 1) {
                        view.resetZoomLazy();
                    } else {
                        xOffset = view.zoom.translate()[0];
                        drawCanvas();
                    }
                }
            }
        }, 700);

        var buffer = document.createElement('canvas');
        var bufferMargin = 200;
        var bufferWidth;
        var context0 = buffer.getContext("2d");
        var countDC = 0;
        function drawCanvas() {
            countDC += 1;
            context0.setTransform(1, 0, 0, 1, 0, 0);
            context0.clearRect(0, 0, bufferWidth, canvasHeight);
            context0.beginPath();
            context0.moveTo(0,canvasHeight);
            context0.lineTo(view.xScale(displayData[0][0])+bufferMargin,canvasHeight);
            for (var i = 0; i < displayData.length; ++i) {
                var x = view.xScale(displayData[i][0])+bufferMargin;
                if (x < -10) continue;
                else if (x > bufferWidth+10) break;
                context0.lineTo(x, yScale(displayData[i][1]));
            }
            context0.lineTo(view.xScale(displayData[displayData.length-1][0])+bufferMargin,canvasHeight);
            context0.fillStyle = scope.color;
            context0.fill();
            context.clearRect(0, 0, canvasWidth, canvasHeight);
            context.drawImage(context0.canvas, bufferMargin, 0, canvasWidth, canvasHeight, 0, 0, canvasWidth, canvasHeight);
        }
        
        // allow the y axis to be rescaled through dragging
        var ydragging = false;
        var downy;
        function yaxisDragStart() {
            ydragging = true;
            downy = yScale.invert(d3.mouse(this)[1]); // jshint ignore:line
        }
        function yaxisDrag() {
            if (ydragging) {
                var p = d3.mouse(this), // jshint ignore:line
                    rupy = yScale.invert(p[1]),
                    yaxis1 = yScale.domain()[0],
                    yaxis2 = yScale.domain()[1],
                    yextent = yaxis2 - yaxis1;
                if (rupy !== 0) {
                    var changey, newDomain;
                    changey = downy / rupy;
                    newDomain = [yaxis1,  yaxis1 + (yextent * changey)];
                    yScale.domain(newDomain);
                    svg.select("g.y.axis").call(yAxis);
                    resetZoom();
                }
                d3.event.preventDefault();
                d3.event.stopPropagation();
            }
        }
        function yaxisDragStop() {
            ydragging = false;
        }
        svg.on("mousemove", yaxisDrag).on("mouseup", yaxisDragStop);

        var currZoomLevel;
        var currChunkIndexes, lastZoom, lastTop, lastBottom;
        var update = function(givenZoomLevel) {
            if (!scope.track || !trackLoaded) return; // Can't do anything until our track has been set and loaded

            svg.select("g.x.axis").call(xAxis);
            svg.select("g.y.axis").call(yAxis);

            // draw from our buffer canvas (this is fast because everything is already rasterized)
            var dx = -(view.zoom.translate()[0]-xOffset);
            context.clearRect(0, 0, canvasWidth, canvasHeight);
            //context.drawImage(context0.canvas, dx/view.zoom.scale()+bufferMargin, 0, canvasWidth/view.zoom.scale(), canvasHeight, 0, 0, canvasWidth, canvasHeight);

            var rawStart = dx/view.zoom.scale()+bufferMargin;
            var adjStart = Math.max(rawStart, 0);
            var startDiff = adjStart-rawStart;
            var rawWidth = canvasWidth/view.zoom.scale();
            var adjWidth = Math.min(rawWidth, bufferWidth-adjStart-1);
            var destStart = (startDiff/rawWidth) * canvasWidth;// Math.min(Math.max(dx, 0), canvasWidth-1); //(adjStart-rawStart)*view.zoom.scale();
            
            //(rawStart+rawWidth) - (adjStart+adjWidth)
            context.drawImage(context0.canvas, adjStart, 0, adjWidth, canvasHeight, destStart, 0, canvasWidth*(adjWidth/rawWidth), canvasHeight);
            //console.log(context0.canvas, adjStart, 0, adjWidth, canvasHeight, destStart, 0, canvasWidth*(adjWidth/rawWidth), canvasHeight);

            // compute chunk indexes and zoom level
            var range = view.xScale.domain();
            if (givenZoomLevel) currZoomLevel = givenZoomLevel;
            else currZoomLevel = computeZoomLevel(range);
            var chunkSize = Math.pow(4,currZoomLevel);
            var bottom = Math.max(0, Math.floor(range[0]/chunkSize));
            var top = Math.floor(range[1]/chunkSize);

            // Fetch new data and draw it if we have changed what tiles we cover
            if (displayData.length === 0 || lastZoom !== currZoomLevel || lastTop !== top || lastBottom !== bottom) {
                updateDisplayData();
            }

            lastZoom = currZoomLevel;
            lastTop = top;
            lastBottom = bottom;
        };
        view.updateFunctions.push(update);

        function gotChunkData(level, ind, data) {
            dataCache[level][ind] = data;
            updateDisplayData();
        }
        function gotChunkError(level, ind, data, statusCode) {
            if (statusCode === 404) dataCache[level][ind] = 0;
            updateDisplayData();
        }
        function addChunks(outArray, range, minLevel, level, ind) {
            if (level === undefined) {
                level = maxLevel;
                ind = 0;
            }
            var chunkSize = Math.pow(4,level-1);
            var bottom = Math.max(0, Math.floor(range[0]/chunkSize));
            var top = Math.floor(range[1]/chunkSize);

            // If we are at the minimum level needed then just add our chunk and return
            if (level <= minLevel) {
                if (typeof(dataCache[level][ind]) === "object") { // only add if we are loaded
                    Array.prototype.push.apply(outArray,dataCache[level][ind]);
                    return true;
                }
                return false;
            }

            var completeData = true; // start optimistically
            for (var i = bottom; i <= top; ++i) {

                // This subchunk was missing from the server, so all our subchunks must be missing and we are the lowest chunk
                if (dataCache[level-1][i] === 0) {
                    if (typeof(dataCache[level][ind]) === "object") { // only add if we are loaded
                        Array.prototype.push.apply(outArray,dataCache[level][ind]);
                        return true;
                    }
                    return false;
                
                // Recurse on the subchunk, loading it if needed
                } else {
                    if (typeof(dataCache[level-1][i]) !== "object") completeData = false;
                    if (dataCache[level-1][i] === undefined) {
                        dataCache[level-1][i] = 1;
                        $http.get(storageRoot+scope.track+".level"+(level-1)+"."+(i*chunkSize+1)+"."+((i+1)*chunkSize)+".json")
                            .success(_.partial(gotChunkData, level-1, i))
                            .error(_.partial(gotChunkError, level-1, i));
                    }

                    completeData = addChunks(
                        outArray,
                        [Math.max(i*chunkSize, range[0]), Math.min((i+1)*chunkSize-0.000001, range[1])],
                        minLevel,
                        level-1,
                        i
                    ) && completeData;
                }
            }

            return completeData;
        }
        
        // draw background panel to catch events
        var backgroundRect = svg.append("rect") 
            .attr("class", "scalable-series-pane");

        // draw the x-axis
        var xaxisGroup = svg.append("g")
            .attr("class", "x axis")
            .attr("transform", "translate(0,20)");
        
        // draw the y-axis in front of a backing panel
        var yaxisBacking = svg.append("rect")
            .attr("class", "scalable-series-yaxisBacking")
            .attr("width", 40)
            .attr("x", 0)
            .on("mousedown.drag", yaxisDragStart);
        var yaxisGroup = svg.append("g")
            .attr("class", "y axis");

        // this is a label used to indicate when no data was found
        var notFoundLabel = svg.append('text')
            .attr("text-anchor", "middle")
            .attr("fill", "#ccc")
            .attr("display", "none")
            .attr("font-size", "14px");

        function computeZoomLevel(range) {
            var size = Math.max(10, range[1] - range[0]);
            
            // a data point every so many pixels
            var pixelSampleRate = 1000;
            var level = Math.log((element.width()/pixelSampleRate)/size)/Math.log(4);
            var val = -parseInt(Math.round(level)); // levels are powers of 4 downsampling
            return Math.max(minLevel, Math.min(maxLevel, val)); 
        }

        function loadTrack() {

            // Compute this before angular hides us and we lose access to our true element width
            var zoomLevel = computeZoomLevel(view.zoom.x().domain());

            $http.get(storageRoot+scope.track+".json").success(function(metadata) {
                if (metadata === "not found\n") {
                    notFoundLabel.attr("display", "block").text("no track data found for "+scope.track+"...");

                    // If we could not load the track make sure all old data is gone
                    displayData = [];
                } else {
                    notFoundLabel.attr("display", "none");
                    xmin = metadata.minPosition;
                    xmax = metadata.maxPosition;
                    minLevel = metadata.minLevel;
                    maxLevel = metadata.maxLevel;
                    console.log("metadata", metadata);

                    trackLoaded = true;
                    update(zoomLevel);
                }
            }).error(function() { console.log("Could not load track:", scope.track); });
        }

        // update the sizing of everything
        function resize() {
            marginTop = scope.hideXAxis === "true" ? 3 : 23;
            element.height(scope.height);
            $(element).find(".scalable-series-paddingDiv").css("height", marginTop);
            canvasWidth = $(window).width();
            canvasHeight = element.height()-marginTop-marginBottom;
            bufferWidth = canvasWidth + 2*bufferMargin;
            canvas
                .attr("width", canvasWidth)
                .attr("height", canvasHeight);
            svgElement
                .style("height", element.height())
                .style("top", -canvasHeight-marginTop-8); // don't know where 8 comes from...but it makes things line up
            
            buffer.width = bufferWidth;
            buffer.height = canvasHeight;

            yAxis.tickSize(-element.width()-30);

            view.xScale.range([0, element.width()]);
            view.zoom.x(view.xScale);
            yScale.range([canvasHeight, 0]);

            backgroundRect
                .attr("width", element.width())
                .attr("height", element.height())
                .call(view.zoom);
            canvas.call(view.zoom);
            yaxisBacking
                .attr("height", element.height()-marginTop)
                .attr("y", marginTop);
            yaxisGroup.attr("transform", "translate(" + 40 + ", " + (marginTop+2) + ")");
            xaxisGroup.call(xAxis);

            notFoundLabel
                .attr("x", element.width()/2)
                .attr("y", element.height()/2+7);

            if (currChunkIndexes) resetZoom();
        }
        
        scope.$watch('track', function(newVal, oldVal) {
            if (newVal !== oldVal) { // for some reason the element width is not right when our first watch fires
                dataCache = _.object(_.map(_.range(20), function(i) { return [i, {}]; })); // clear data from old track
                loadTrack();
            }
        });

        scope.$watch('height', function(newVal, oldVal) {
            if (newVal !== oldVal) resize();
        });

        scope.$watch('hideXAxis', function(newVal, oldVal) {
            if (newVal !== oldVal) resize();
        });

        resize();
        loadTrack();
	}
};});
