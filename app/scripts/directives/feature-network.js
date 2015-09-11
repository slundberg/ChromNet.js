'use strict';

/**
 * @ngdoc directive
 * @name linkClientApp.directive:featureNetwork
 * @description
 * # featureNetwork
 */
angular.module('linkClientApp').directive('featureNetwork', function () { return {
	template: '<svg class="no-select"></svg>',
	restrict: 'E',
	transclude: false,
	'scope': {
		nodes: '=nodes',
        groups: '=',
		links: '=',
		typeMap: '=',
		//selectedNodes: '=',
        selectedNode: '=',
        hoverNode: '=',
        hoverEdge: '='
	},
	link: function postLink(scope, element) {
		var svgElement = $(element).find('svg');
        var width = $(window).width();
        var height = $(window).height();
        var force = d3.layout.force()
            .charge(function(d) { if (d.group) return 0; else if (d.highlight) return -180; else return -100; })
            .linkDistance(120)
            .gravity(0)
            .linkStrength(0.05)
            .size([width, height]);

        // Just scale and translate everything when we zoom/pan
        var zoom = d3.behavior.zoom().on('zoom', function() {
            svg.attr('transform', 'translate(' + d3.event.translate + ')scale(' + d3.event.scale + ')');
            d3.event.sourceEvent.stopPropagation();
        });

        var tmpCounter = 0;

        // A drag force that will be attached to the nodes
        // we stop propagation to prevent draging a node being confused with panning the whole diagram
        var drag = force.drag().on('dragstart', function() { d3.event.sourceEvent.stopPropagation(); });

   		// Build our svg container and the background box to catch click events
        var svgTop = d3.select(svgElement[0])
                .attr('width', width)
                .attr('height', height)
              .append('g')
                .call(zoom);
            svgTop.append('rect') // This is just here to catch scroll events for zooming
                .attr('width', width)
                .attr('height', height)
                .attr('fill', '#fff')
                .on('click', function() {
                    if (d3.event.defaultPrevented) return;
                    if (scope.selectedNode) {
                        scope.selectedNode.selected = false;
                        scope.selectedNode = undefined;
                        scope.buildGraph();
                        scope.$parent.$digest();
                    }
                });
        var svg = svgTop.append('g');
        var svg1 = svg.append('g');
        var groupHulls = svg1.selectAll('.groupHulls');
        var svg2 = svg.append('g');
        var nodeBoxes = svg2.selectAll('.node');
        var nodeLabels = svg2.selectAll('.nodeLabels');
        var nodeSublabels = svg2.selectAll('.nodeSublabels');
        var linkLines = svg2.selectAll('.link');
        var linkClips = svg2.selectAll('.linkClips');

        // define a drop shadow filter for use when highlighting the endpoints of links
        var defs = svgTop.append('defs');
        var dropShadow = defs.append('filter')
            .attr('id', 'dropShadow')
            .attr('x', '-40%')
            .attr('y', '-40%')
            .attr('width', '180%')
            .attr('height', '180%');
        dropShadow.append('feGaussianBlur')
            .attr('in', 'SourceGraphic')
            .attr('stdDeviation', '4');
        dropShadow.append('feOffset')
            .attr('dx', '0')
            .attr('dy', '0')
            .attr('result', 'offOut');
        dropShadow.append('feFlood')
             .attr('flood-color', 'rgba(0,0,0,0.3)');
        dropShadow.append('feComposite')
            .attr('in2', 'offOut')
            .attr('operator', 'in');
        var feMerge = dropShadow.append('feMerge');
        feMerge.append('feMergeNode');
        feMerge.append('feMergeNode')
            .attr('in', 'SourceGraphic');
        defs.append("svg:marker")
            .attr("id", "linkMark")
            .attr("viewBox", "-5 -5 10 10")
            .attr("refX", -1)
            .attr("markerWidth", 4)
            .attr("markerHeight", 4)
            .attr("orient", "auto")
          .append("circle")
            .attr("r", 4)
            .attr("fill", '#00');

		// update the interface whenever the graph may have changed
		scope.buildGraph = function() {
            //console.log(scope.nodes)
            //scope.nodes = scope.nodesRef.splice(0);
            scope.singleNodes = _.filter(scope.nodes, function(d) { return !d.group;});
            scope.groupNodes = _.filter(scope.nodes, function(d) { return d.group;}).reverse();
            console.log("scope.groupNodes", scope.groupNodes);

            function nearestNodePos(node) {
                var d = node;
                while (d.parent) {
                    d = d.parent;
                    if (!isNaN(d.x) && d.type === node.type) {
                        return [d.x, d.y];
                    }
                }
                return [centerx, centery];
            }

            for (var i = 0; i < scope.nodes.length; ++i) {
                var d = scope.nodes[i];

                // Save all the intersection tests we should be running
                d.intTests = [];
                for (var j = 0; j < scope.nodes.length; ++j) {
                    if (!ancestoryTest(d, scope.nodes[j])) {
                        d.intTests.push(scope.nodes[j]);
                    }
                }

                // Compute the colors for all the nodes
                if (d.type !== undefined) {
                    d.color = scope.typeMap[d.type].color;
                } else {
                    d.color = d3.rgb(103, 103, 103);
                }
            }

            for (var i = scope.nodes.length-1; i >= 0; --i) {
                var d = scope.nodes[i];

                // place new nodes near others in the same cluster
                if (d.x === undefined) {
                    var p = nearestNodePos(d);
                    d.x = p[0]+10;
                    d.y = p[1]+10;
                }
            }

            var centerx = width/2;
            var centery = height/2;
            scope.singleNodes.forEach(function(d, i) {
                if (isNaN(d.x)) {
                    d.x = d.px = centerx + (i - 0.5*scope.singleNodes.length)*30;
                    d.y = d.py = centery + (Math.random()-0.5)*50;
                }
            });

            function whiter(c, amount) {
                c = d3.rgb(c);
                return d3.rgb(c.r+(255-c.r)*amount, c.g+(255-c.g)*amount, c.b+(255-c.b)*amount);
            }

            scope.links.forEach(function(d, i) {
                d.uuid = d.source.uuid + "_" + d.target.uuid;
            });

            force.nodes(scope.nodes).links(scope.links).start();

            // Build and update all the group hulls
            groupHulls = groupHulls.data(scope.groupNodes);
            groupHulls.enter().append('path')
                .attr('stroke-linejoin', 'round');
            groupHulls.style('fill', function(d) {
                    d.domNode = this;
                    return whiter(d.color, 1-d.groupScore);
                })
                .attr('stroke', function(d) { return whiter(d.color, 1-d.groupScore); })
                .attr('stroke-width', function(d) { return d.level*6+'px'; })
                .on('mouseover', function(d) {
                    //if (d3.event.defaultPrevented) return;
                    scope.hoverType = d.type;
                    scope.$parent.$digest();
                })
                .on('mouseout', function(d) {
                    //if (d3.event.defaultPrevented) return;
                    if (scope.hoverType === d.type) {
                        scope.hoverType = undefined;
                        scope.$parent.$digest();
                    }
                });
            groupHulls.exit().remove();

            window.groupHulls = groupHulls;


            nodeBoxes = nodeBoxes.data(scope.singleNodes, function(d) { return d.uuid; });
            nodeBoxes.enter().append('rect')
                .attr('rx', 3)
                .attr('ry', 3);
            nodeBoxes.exit().remove();
            nodeBoxes.attr('height', function(d) {
                d.domNode = this;
                return d.selected ? 36 : d.highlight ? 30 : 22;
            });

            nodeLabels = nodeLabels.data(scope.singleNodes, function(d) { return d.uuid; });
            nodeLabels.enter().append('text')
                .text(function(d) { return d.name; })
                .attr('fill', '#fff')
                .attr('opacity', function(d) {
                    return d.highlight ? 1.0 : 1;
                })
                .attr('class', 'no-select')
                .attr('font-family', 'monaco')
                .attr('pointer-events', 'none');
            nodeLabels.exit().remove();
            nodeLabels.attr('font-size', function(d) {
                return d.selected ? 18 : d.highlight ? 12 : 9;
            });

            nodeLabels.each(function(d) {
                d.halfLabelWidth = this.getComputedTextLength()/2;
                d.halfTextHeight = d.selected ? 11 : d.highlight ? 5 : 3;
            });

            nodeSublabels = nodeSublabels.data(scope.singleNodes, function(d) { return d.uuid; });
            nodeSublabels.enter().append('text')
                .text(function(d) { return "ChIP-seq"; })
                .attr('fill', '#fff')
                .attr('opacity', function(d, i, j) {
                    return d.highlight ? 1.0 : 1;
                })
                .attr('class', 'no-select')
                .attr('font-family', 'monaco')
                .attr('cursor', 'default')
                .attr('pointer-events', 'none')
                .attr('style', '-webkit-font-smoothing: antialiased');
            nodeSublabels.exit().remove();
            nodeSublabels.attr('font-size', function(d) {
                //return scope.selectedNode && scope.selectedNode.data.id === d.data.id ? 18 : 10;
                return d.selected ? 8 : d.highlight ? 7 : 6;
            });

            linkLines = linkLines.data(scope.links, function(d) { return d.uuid; });
            linkLines.enter().insert('path', ':first-child')
                .attr('stroke', '#000')
                .attr('stroke-width', '3px')
                .attr('mask', function(d) { return "url(#"+d.uuid+")"; })
                .attr('opacity', 0.4);
            linkLines.on('mouseover', function(d) {
                d3.select(d.source.domNode).attr('filter', 'url(#dropShadow)');
                d3.select(d.target.domNode).attr('filter', 'url(#dropShadow)');
                scope.hoverEdge = d;
                window.lasthe = d;
                scope.$parent.$digest();
            }).on('mouseout', function(d) {
                d3.select(d.source.domNode).attr('filter', '');
                d3.select(d.target.domNode).attr('filter', '');
                scope.hoverEdge = undefined;
                scope.$parent.$digest();
            });
            linkLines.exit().remove();
            linkLines.attr('opacity', function(d) { if (d.lighten) return 0.05; else return 0.4; });
            linkLines.attr('stroke-dasharray', function(d) { return d.coeff < 0 ? '5,5' : 'none' ; });
            linkLines.attr("marker-mid", function(d) { return d.marked ? "url(#linkMark)" : "none"; });


            linkClips = linkClips.data(scope.links, function(d) { return d.uuid; });
            var linkClipsG = linkClips.enter().append('mask')
                .attr('id', function(d) { return d.uuid; })
                .attr('x', '-3000px')
                .attr('y', '-3000px')
                .attr('width', '10000px')
                .attr('height', '10000px')
                .attr('maskUnits', 'userSpaceOnUse')
                .style('stroke-dasharray', 'none');
            linkClipsG.append('rect')
                .attr('fill', 'white')
                .attr('x', '-3000px')
                .attr('y', '-3000px')
                .attr('width', '10000px')
                .attr('height', '10000px');
            linkClipsG.append('path')
                .attr('fill', 'black')
                .attr('stroke', 'black')
                .attr('stroke-width', function(d) { return d.source.level*6+'px'; })
                .attr('stroke-linejoin', 'round')
                .attr('stroke-dasharray', 'none');
            linkClipsG.append('path')
                .attr('fill', 'black')
                .attr('stroke', 'black')
                .attr('stroke-width', function(d) { return d.target.level*6+'px'; })
                .attr('stroke-linejoin', 'round')
                .attr('stroke-dasharray', 'none');
            linkClips.exit().remove();

            nodeSublabels.each(function(d) {
                d.halfSublabelWidth = this.getComputedTextLength()/2;
                d.halfTextWidth = Math.round(Math.max(d.halfSublabelWidth, d.halfLabelWidth));
                d.sublabelShift = Math.max(0, d.halfLabelWidth - d.halfSublabelWidth);
                d.sublabelDrop = d.selected ? 11 : d.highlight ? 10 : 8;
                d.labelShift = Math.max(0, d.halfSublabelWidth - d.halfLabelWidth);
            });

            nodeBoxes
            	.attr('width', function(d) { return d.halfTextWidth*2 + (d.selected ? 16 : d.highlight ? 12 : 8); })
                .style('fill', function(d) {
                	return d.color;//var t = scope.typeMap[d.data.cellType];
                	//return d.color ? t.color : t.color;
                })
                .attr('cursor', 'default')
                .on('click', function(d) {
                    if (d3.event.defaultPrevented) return;
                    if (scope.selectedNode === d) {
                        d.selected = undefined;
                        scope.selectedNode = undefined;
                    } else {
                        if (scope.selectedNode) scope.selectedNode.selected = undefined;
                        d.selected = true;
                        scope.selectedNode = d;
                    }
                    // if (_.find(scope.selectedNodes, d)) {
                    //     _.remove(scope.selectedNodes, d);
                    //     d.selected = undefined;
                    // } else {
                    //     scope.selectedNodes.push(d);
                    //     d.selected = true;
                    // }
                    scope.buildGraph();
                    scope.$parent.$digest(); // we have to trigger a digest up one layer so our parent knows about the change
                })
                .on('mouseover', function(d) {
                    if (d3.event.defaultPrevented) return;
                    scope.hoverType = d.type;
                    scope.hoverNode = d;
                    scope.$parent.$digest();
                })
                .on('mouseout', function(d) {
                    if (d3.event.defaultPrevented) return;
                    if (scope.hoverType === d.type) {
                        scope.hoverType = undefined;
                        scope.hoverNode = undefined;
                        scope.$parent.$digest();
                    }
                })
                .call(drag);

            // http://bl.ocks.org/mbostock/4218871
            function pointInPolygon(point, polygon) {
              for (var n = polygon.length, i = 0, j = n - 1, x = point[0], y = point[1], inside = false; i < n; j = i++) {
                var xi = polygon[i][0], yi = polygon[i][1],
                    xj = polygon[j][0], yj = polygon[j][1];
                if ((yi > y ^ yj > y) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
              }
              return inside;
            }

            // based on mathematical from http://www.ecse.rpi.edu/Homepages/wrf/Research/Short_Notes/pnpoly.html (the convex alternative)
            // and http://www.cut-the-knot.org/Curriculum/Calculus/DistanceToLine.shtml
            // the delta arg is a cheap way to pass back the direction to the closest line
            // padding lets us consider an intersection to occur even outside the original polygon
            function pointInConvexPolygon(point, polygon, delta, padding) {
                var minDist = 1000000;
                for (var n = polygon.length, i = 0, j = n - 1, x = point[0], y = point[1], inside = false; i < n; j = i++) {
                    var xi = polygon[i][0], yi = polygon[i][1],
                        xj = polygon[j][0], yj = polygon[j][1];

                    // See if we this is a separating line
                    var dx = (xj-xi);
                    var dy = (yj-yi);
                    var d = (y-yi)*dx - (x-xi)*dy;
                    var l = Math.sqrt(dx*dx + dy*dy);
                    d /= l;
                    d += padding;
                    if (d <= 0) return 0;

                    // If not save the delta from the closest line we crossed
                    if (d < minDist) {
                    minDist = d;
                        delta[0] = dy/l;
                        delta[1] = -dx/l;
                    }
                }
                return minDist;
            }

            // This is a symmetric test, and is true if either is the ancestor of the other
            function ancestoryTest(node1, node2) {
                var tmp = node1;
                while (tmp) {
                    if (tmp === node2) return true;
                    tmp = tmp.parent;
                }
                tmp = node2;
                while (tmp) {
                    if (tmp === node1) return true;
                    tmp = tmp.parent;
                }
                return false;
            }



            // http://stackoverflow.com/questions/9043805/test-if-two-lines-intersect-javascript-function
            // returns true iff the line from (a,b)->(c,d) intersects with (p,q)->(r,s)
            function intersects(a,b,c,d,p,q,r,s) {
              var det, gamma, lambda;
              det = (c - a) * (s - q) - (r - p) * (d - b);
              if (det === 0) {
                return false;
              } else {
                lambda = ((s - q) * (r - a) + (p - r) * (s - b)) / det;
                gamma = ((b - d) * (r - a) + (c - a) * (s - b)) / det;
                return (0 < lambda && lambda < 1) && (0 < gamma && gamma < 1);
              }
            }

            function polygonIntersectLine(polygon, a,b,c,d) {
                for (var n = polygon.length, i = 0, j = n - 1; i < n; j = i++) {
                    var xi = polygon[i][0], yi = polygon[i][1],
                        xj = polygon[j][0], yj = polygon[j][1];
                    if (intersects(a, b, c, d, xi, yi, xj, yj)) {
                        return [[xi, yi], [xj, yj]];
                    }
                }
                return []; // sometimes a tick fires while the graph is still being updated and a failed intersection can occur. console.log("FAIL!!", polygon, a, b, c,d)
            }

            // build a relative offset tree of all the nodes, where every node's location is determined as an offset from their parent
            for (var i = scope.nodes.length-1; i >= 0; --i) {
                var d = scope.nodes[i];
                d.ox = 0;
                d.oy = 0;
                if (!d.parent) {
                    d.ox = d.x;
                    d.oy = d.y;
                } else {
                    d.ox = d.x - d.parent.x;
                    d.oy = d.y - d.parent.y;
                }
                d.lastx = d.x;
                d.lasty = d.y;
            }

            // Init the group sizes from the bottom up
            for (var i = 0; i < scope.nodes.length; ++i) {
                var d = scope.nodes[i];
                if (!d.group) {
                    d.groupSize = 1.0;
                } else {
                    if (d.child1 && d.child2) {
                        d.groupSize = d.child1.groupSize + d.child2.groupSize;
                    } else if (d.child1) {
                        d.groupSize = d.child1.groupSize;
                    } else {
                        d.groupSize = d.child2.groupSize;
                    }
                }
            }
            //console.log("scope.nodes", scope.nodes)

            var line = d3.svg.line();
            var cforcex = height/(width+height) * 2;
            var cforcey = width/(width+height) * 2;
            var countTicks = 0;
            var firstTick = true;
            force.on('tick', function() {
                ++countTicks;
                var alpha = force.alpha();
                //force.alpha(0.01)
                //var quadtree = d3.geom.quadtree();

                // // Pull nodes towards the center of their clusters
                // for (var i = 1; i < scope.groupNodes.length; ++i) {
                //     var d = scope.groupNodes[i];
                //     d.x += -(d.x-d.parent.x);
                //     d.y += -(d.y-d.parent.y);
                // }



                // // work from the top down incorperating all the collisions and forces
                // for (var i = scope.nodes.length-1; i >= 0; --i) {
                //     var d = scope.nodes[i];

                //     // Offsets that are propagating down
                //     if (!d.parent) {
                //         d.ox = 0;
                //         d.oy = 0;
                //         d.opx = 0;
                //         d.opy = 0;
                //     } else {
                //         d.ox = d.parent.ox;
                //         d.oy = d.parent.oy;
                //         d.opx = d.parent.opx;
                //         d.opy = d.parent.opy;
                //     }

                //     //if (i === scope.nodes.length-2) console.log("d.ox", i, d.ox, d.parent.x, d.x, d.px, d.lastx)
                //     //else force.stop()




                //     if (d.parent && d.level === 0) {

                //         // // gravity towards the center of the screen. Proportional to the window aspect ratio.
                //         // if (d.highlight) {
                //         //     d.x -= alpha*0.04*(d.x-centerx)*cforcex; // used to 0.2
                //         //     d.y -= alpha*0.04*(d.y-centery)*cforcey; // used to 0.2
                //         // } else {
                //         //     d.x -= alpha*0.02*(d.x-centerx)*cforcex;
                //         //     d.y -= alpha*0.02*(d.y-centery)*cforcey;
                //         // }

                //         // // Pull nodes towards the center of their clusters
                //         // d.x -= alpha*0.0007*(d.x-d.parent.x)*Math.abs(d.x-d.parent.x)*cforcex;//*d.parent.groupScore;
                //         // d.y -= alpha*0.0007*(d.y-d.parent.y)*Math.abs(d.y-d.parent.y)*cforcey;//*d.parent.groupScore;

                //         // // Detect collisions
                //         // var delta = [0.0,0.0];
                //         // for (var j = 0; j < d.intTests.length; ++j) {
                //         //     if (d.intTests[j].hullPoints && d.hullPoints) {
                //         //         for (var k = 0; k < d.hullPoints.length; ++k) {
                //         //             var dist = pointInConvexPolygon(d.hullPoints[k], d.intTests[j].hullPoints, delta, (d.level+d.intTests[j].level)*7);
                //         //             if (dist > 0) {

                //         //                 // Update our hull points as well as our center (and kill all momentum)
                //         //                 var dx = delta[0]*dist;
                //         //                 var dy = delta[1]*dist;
                //         //                 for (var l = 0; l < d.hullPoints.length; ++l) {
                //         //                     d.hullPoints[l][0] += dx;
                //         //                     d.hullPoints[l][1] += dy;
                //         //                 }
                //         //                 d.x += dx;
                //         //                 d.y += dy;
                //         //                 d.px += dx;
                //         //                 d.py += dy;
                //         //             }
                //         //         }
                //         //     }
                //         // }
                //     }

                //     // d.x += d.ox;
                //     // d.y += d.oy;
                //     // d.px += d.opx;
                //     // d.py += d.opy;
                // }

                // Work from the bottom up computing hull points and drawing the shapes
                // for (var i = 0; i < scope.nodes.length; ++i) {
                //     var d = scope.nodes[i];
                //     if (!d.visible) {
                //         console.log("not visible");
                //     }

                //     // d.ox += d.x - d.lastx;
                //     // d.oy += d.y - d.lasty;

                //     // Handle base nodes
                //     if (!d.group) {

                //         // gravity towards the center of the screen. Proportional to the window aspect ratio.
                //         if (d.highlight) {
                //             d.x -= alpha*0.04*(d.x-centerx)*cforcex; // used to 0.2
                //             d.y -= alpha*0.04*(d.y-centery)*cforcey; // used to 0.2
                //         } else {
                //             d.x -= alpha*0.02*(d.x-centerx)*cforcex;
                //             d.y -= alpha*0.02*(d.y-centery)*cforcey;
                //         }

                //         // Pull nodes towards the center of their clusters
                //         d.x -= alpha*0.0007*(d.x-d.parent.x)*Math.abs(d.x-d.parent.x)*cforcex;//*d.parent.groupScore;
                //         d.y -= alpha*0.0007*(d.y-d.parent.y)*Math.abs(d.y-d.parent.y)*cforcey;//*d.parent.groupScore;

                //         var xdelta = d.halfTextWidth + (d.selected ? 8 : d.highlight ? 6 : 4) - 0;
                //         var ydelta = (d.selected ? 18 : d.highlight ? 15 : 11) - 0;
                //         d.hullPoints = [
                //             [d.x+xdelta,d.y+ydelta],
                //             [d.x+xdelta,d.y-ydelta],
                //             [d.x-xdelta,d.y-ydelta],
                //             [d.x-xdelta,d.y+ydelta]
                //         ];

                //         // Detect collisions
                //         if (d.intTests) { // in case we run before intTests is updated
                //             var delta = [0.0,0.0];
                //             for (var j = 0; j < d.intTests.length; ++j) {
                //                 var d2 = d.intTests[j];
                //                 if (d2.hullPoints && d.hullPoints) {
                //                     for (var k = 0; k < d.hullPoints.length; ++k) {
                //                         var dist = pointInConvexPolygon(d.hullPoints[k], d2.hullPoints, delta, (d.level+d2.level)*7);
                //                         if (dist > 0) {

                //                             // Update our hull points as well as our center (and kill all momentum)
                //                             var dx = delta[0]*dist;
                //                             var dy = delta[1]*dist;
                //                             for (var l = 0; l < d.hullPoints.length; ++l) {
                //                                 d.hullPoints[l][0] += dx;
                //                                 d.hullPoints[l][1] += dy;
                //                             }
                //                             d.x += dx;
                //                             d.y += dy;
                //                             d.px = d.x;
                //                             d.py = d.y;

                //                             // // push the other polygon over as well
                //                             // for (var l = 0; l < d2.hullPoints.length; ++l) {
                //                             //     d2.hullPoints[l][0] -= dx;
                //                             //     d2.hullPoints[l][1] -= dy;
                //                             // }
                //                             // d2.ox = dx;
                //                             // d2.oy = dy;
                //                         }
                //                     }
                //                 }
                //             }
                //         }

                //         // update the position of the base node
                //         d3.select(d.domNode)
                //             .attr('x', d.x-d.halfTextWidth - (d.selected ? 8 : d.highlight ? 6 : 4))
                //             .attr('y', d.y-(d.selected ? 18 : d.highlight ? 15 : 11))

                //     // Handle group nodes
                //     } else {

                //         if (d.child1.visible && d.child2.visible && d.child1.hullPoints && d.child2.hullPoints) {
                //             d.hullPoints = d3.geom.hull(d.child1.hullPoints.concat(d.child2.hullPoints));
                //             d.x = d.px = (d.child1.groupSize*d.child1.x + d.child2.groupSize*d.child2.x)/d.groupSize;
                //             d.y = d.py = (d.child1.groupSize*d.child1.y + d.child2.groupSize*d.child2.y)/d.groupSize;

                //         // +1.0 keeps the nodes from being perfectly on top of one another
                //         // ...something the force layout does not like even with 0 charge on the group nodes
                //         } else if (d.child1.visible && d.child1.hullPoints) {
                //             d.x = d.px = d.child1.x+1.0;
                //             d.y = d.py = d.child1.y+1.0;
                //             d.hullPoints = d.child1.hullPoints;

                //         } else if (d.child2.hullPoints) {
                //             d.x = d.px = d.child2.x+1.0;
                //             d.y = d.py = d.child2.y+1.0;
                //             d.hullPoints = d.child2.hullPoints;
                //         }

                //         // update the position of the group node
                //         d3.select(d.domNode).attr('d', "M" + d.hullPoints.join("L") + "Z");
                //     }
                // }

                // I use d3's each function rather than a native loop through scope.nodes because scope.nodes can
                // change underneath the ticker from AngularJS. In contrast nodeBoxes doesn't change until everything
                // is set and ready to tick
                nodeBoxes.each(function(d) {

                    if (!d.fixed) {

                        // gravity towards the center of the screen. Proportional to the window aspect ratio.
                        // highlighed nodes get pulled to the center more strongly
                        if (d.highlight) {
                            d.x -= alpha*0.04*(d.x-centerx)*cforcex;
                            d.y -= alpha*0.04*(d.y-centery)*cforcey;
                        } else {
                            d.x -= alpha*0.02*(d.x-centerx)*cforcex;
                            d.y -= alpha*0.02*(d.y-centery)*cforcey;
                        }

                        // Pull nodes towards the center of their clusters (only after the cluster centers)
                        if (d.parent && !isNaN(d.parent.x) && !firstTick) { // parents might not have a position when first added

                            var dx = alpha*0.007*(d.x-d.parent.x)*Math.abs(d.x-d.parent.x)*cforcex;//*d.parent.groupScore;
                            //console.log("tt", d.x, d.parent.x, dx);
                            var dy = alpha*0.007*(d.y-d.parent.y)*Math.abs(d.y-d.parent.y)*cforcey;//*d.parent.groupScore;
                            d.x -= dx;
                            d.px -= dx;
                            d.y -= dy;
                            d.py -= dy;
                        }
                    }

                    if (d.parent && isNaN(d.parent.x)) {
                        //console.log("problem")
                    }

                    var xdelta = d.halfTextWidth + (d.selected ? 8 : d.highlight ? 6 : 4) - 0;
                    var ydelta = (d.selected ? 18 : d.highlight ? 15 : 11) - 0;
                    d.hullPoints = [
                        [d.x+xdelta,d.y+ydelta],
                        [d.x+xdelta,d.y-ydelta],
                        [d.x-xdelta,d.y-ydelta],
                        [d.x-xdelta,d.y+ydelta]
                    ];

                    // Detect collisions // Math.abs(d.x) < 5000 && Math.abs(d.y) < 5000
                    if (d.intTests && !d.fixed) { // in case we run before intTests is updated
                        var delta = [0.0, 0.0];
                        for (var j = 0; j < d.intTests.length; ++j) {
                            var d2 = d.intTests[j];
                            if (d2.hullPoints) { // && d.hullPoints
                                for (var k = 0; k < d.hullPoints.length; ++k) {
                                    var p = d.hullPoints[k];
                                    var dist = pointInConvexPolygon(p, d2.hullPoints, delta, (d.level+d2.level)*7 + 5);
                                    if (dist > 0) {

                                        // Find the highest parent of d that is not shared with d2
                                        ++tmpCounter;
                                        var tmp = d2;
                                        while (tmp) {
                                            tmp.tmpId = tmpCounter;
                                            tmp = tmp.parent;
                                        }
                                        tmp = d;
                                        while (tmp.parent && tmp.parent.tmpId !== tmpCounter) {
                                            tmp = tmp.parent;
                                        }

                                        // Don't worry about it if it is the direct parent since its center will move with us
                                        if (tmp !== d) { // .parent
                                            //console.log(d, tmp);
                                            // make sure we are moving towards our parent's center
                                            var dp = (tmp.x-p[0])*delta[0] + (tmp.y-p[1])*delta[1];
                                            //var len = Math.sqrt(Math.pow(tmp.x-p[0], 2) + Math.pow(tmp.y-p[1], 2));
                                            //var len;
                                            if (dp < 0) {
                                                delta[0] = -delta[0];
                                                delta[1] = -delta[1];
                                                //continue; // rather than move through we just don't react to the edge.
                                                //dist = Math.sqrt(Math.pow(tmp.x-p[0], 2) + Math.pow(tmp.y-p[1], 2));
                                            }

                                        // If we are close siblings then we should be moving apart
                                        // this prevents heavy overlaps where different points try and pull different directions
                                        } else {
                                            var dp = (d2.x-p[0])*delta[0] + (d2.y-p[1])*delta[1];
                                            //console.log(d.data.cellType, dp, dist)
                                            //var len = Math.sqrt(Math.pow(tmp.x-p[0], 2) + Math.pow(tmp.y-p[1], 2));
                                            //var len;
                                            //dist *= 2;
                                            if (dp > 0) {
                                                delta[0] = -delta[0];
                                                delta[1] = -delta[1];
                                                //continue; // rather than move through we just don't react to the edge.
                                                //dist = Math.sqrt(Math.pow(tmp.x-p[0], 2) + Math.pow(tmp.y-p[1], 2));
                                            }
                                        }

                                        // Update our hull points as well as our center (and kill all momentum)
                                        var dx = delta[0]*dist;
                                        var dy = delta[1]*dist;
                                        if (Math.abs(dx) < 200 && Math.abs(dy) < 200) {
                                            for (var l = 0; l < d.hullPoints.length; ++l) {
                                                d.hullPoints[l][0] += dx;
                                                d.hullPoints[l][1] += dy;
                                            }
                                            d.x += dx;
                                            d.y += dy;
                                            d.px = d.x;
                                            d.py = d.y;
                                        } else {
                                            //console.log("cut big move...")
                                        }
                                    }
                                }
                            }
                        }
                    }

                    //console.log("Dx", d.x - d.px, d.y - d.py);

                    // save our positions on the base nodes so they can be reused when the filtering changes
                    if (!d.group) {
                        d.origObj.x = d.x;
                        d.origObj.y = d.y;
                    }
                });
                nodeBoxes
                    .attr('x', function(d) { return d.x-d.halfTextWidth - (d.selected ? 8 : d.highlight ? 6 : 4); })
                    .attr('y', function(d) { return d.y-(d.selected ? 18 : d.highlight ? 15 : 11); });

                for (var i = groupHulls[0].length-1; i >= 0; --i) {
                    var d = groupHulls[0][i].__data__;
                // }
                // for (var i = scope.groupNodes.length-1; i >= 0; --i) {
                //     var d = scope.groupNodes[i];

                    if (d.child1 && d.child2 && d.child1.hullPoints && d.child2.hullPoints) {
                        d.hullPoints = d3.geom.hull(d.child1.hullPoints.concat(d.child2.hullPoints));
                        d.x = d.px = (d.child1.groupSize*d.child1.x + d.child2.groupSize*d.child2.x)/d.groupSize;
                        d.y = d.py = (d.child1.groupSize*d.child1.y + d.child2.groupSize*d.child2.y)/d.groupSize;

                     // +1.0 keeps the nodes from being perfectly on top of one another
                     // ...something the force layout does not like even with 0 charge on the group nodes
                    } else if (d.child1 && d.child1.hullPoints) {
                        d.x = d.px = d.child1.x+1.0;
                        d.y = d.py = d.child1.y+1.0;
                        d.hullPoints = d.child1.hullPoints;

                    } else if (d.child2.hullPoints) {
                        d.x = d.px = d.child2.x+1.0;
                        d.y = d.py = d.child2.y+1.0;
                        d.hullPoints = d.child2.hullPoints;
                    }

                    if (!d.hullPoints) {
                        //console.log("d", d.level, d)
                    } else

                    d3.select(d.domNode).attr('d', "M" + d.hullPoints.join("L") + "Z");
                }

                // for (var i = scope.groupNodes.length-1; i >= 0; --i) {
                //     var d = scope.groupNodes[i];

                //     if (d.child1.visible && d.child2.visible) {
                //         d.hullPoints = d3.geom.hull(d.child1.hullPoints.concat(d.child2.hullPoints));
                //         d.x = d.px = (d.child1.groupSize*d.child1.x + d.child2.groupSize*d.child2.x)/d.groupSize;
                //         d.y = d.py = (d.child1.groupSize*d.child1.y + d.child2.groupSize*d.child2.y)/d.groupSize;

                //     // +1.0 keeps the nodes from being perfectly on top of one another
                //     // ...something the force layout does not like even with 0 charge on the group nodes
                //     } else if (d.child1.visible) {
                //         d.x = d.px = d.child1.x+1.0;
                //         d.y = d.py = d.child1.y+1.0;
                //         d.hullPoints = d.child1.hullPoints;

                //     } else {
                //         d.x = d.px = d.child2.x+1.0;
                //         d.y = d.py = d.child2.y+1.0;
                //         d.hullPoints = d.child2.hullPoints;
                //     }

                //     // update the position of the group node
                //     d3.select(d.domNode).attr('d', "M" + d.hullPoints.join("L") + "Z");
                // }

                // nodeBoxes
                //     .attr('x', function(d) {

                //         // gravity towards the center of the screen. Proportional to the window aspect ratio.
                //         if (d.highlight) {
                //             d.x += -alpha*0.04*(d.x-centerx)*cforcex; // used to 0.2
                //             d.y += -alpha*0.04*(d.y-centery)*cforcey; // used to 0.2
                //         } else {
                //             d.x += -alpha*0.02*(d.x-centerx)*cforcex;
                //             d.y += -alpha*0.02*(d.y-centery)*cforcey;
                //         }

                //         // Pull nodes towards the center of their clusters
                //         d.x += -alpha*0.0007*(d.x-d.parent.x)*Math.abs(d.x-d.parent.x)*cforcex;//*d.parent.groupScore;
                //         d.y += -alpha*0.0007*(d.y-d.parent.y)*Math.abs(d.y-d.parent.y)*cforcey;//*d.parent.groupScore;

                //         // Create some hull points that will be used by enclosing groups
                //         d.groupSize = 1.0;
                //         var xdelta = d.halfTextWidth + (d.selected ? 8 : d.highlight ? 6 : 4) - 0;
                //         var ydelta = (d.selected ? 18 : d.highlight ? 15 : 11) - 0;
                //         d.hullPoints = [
                //             [d.x+xdelta,d.y+ydelta],
                //             [d.x+xdelta,d.y-ydelta],
                //             [d.x-xdelta,d.y-ydelta],
                //             [d.x-xdelta,d.y+ydelta]
                //         ];

                //         // TODO: when this gets slower we could use d3's quadtree to speed up what we test
                //         // TODO: deal with intersections between groups
                //         var delta = [0.0,0.0];
                //         for (var i = 0; i < d.intTests.length; ++i) {
                //             if (d.intTests[i].hullPoints) {
                //                 for (var j = 0; j < d.hullPoints.length; ++j) {
                //                     var dist = pointInConvexPolygon(d.hullPoints[j], d.intTests[i].hullPoints, delta, (d.level+d.intTests[i].level)*7);
                //                     //
                //                     if (dist > 0) {
                //                         //console.log(dist)
                //                         // if (dist > 10) {
                //                         //     var s = "";
                //                         //     for (var tmp2 = 0; tmp2 < d.intTests[i].hullPoints.length; ++tmp2) {
                //                         //         s += "("+d.intTests[i].hullPoints[tmp2][0]+","+d.intTests[i].hullPoints[tmp2][1]+"),";
                //                         //     }

                //                         //     console.log("intersect", dist, d.hullPoints[j], s);
                //                         // }



                //                         // Update our hull points as well as our center (and kill all momentum)
                //                         var dx = delta[0]*dist;
                //                         var dy = delta[1]*dist;
                //                         for (var k = 0; k < d.hullPoints.length; ++k) {
                //                             d.hullPoints[k][0] += dx;
                //                             d.hullPoints[k][1] += dy;
                //                         }
                //                         d.x += dx;
                //                         d.y += dy;
                //                         d.px = d.x;
                //                         d.py = d.y;
                //                     }
                //                 }
                //             }
                //         }

                //         return d.x-d.halfTextWidth - (d.selected ? 8 : d.highlight ? 6 : 4);
                //     })
                //     .attr('y', function(d) { return d.y-(d.selected ? 18 : d.highlight ? 15 : 11); });


                // groupHulls.attr("d", function(d) {
                //     console.log("Dd", d, d.child1.hullPoints, d.child2.hullPoints, d.child2)
                //     if (d.child1.visible && d.child2.visible) {

                //         d.hullPoints = d3.geom.hull(d.child1.hullPoints.concat(d.child2.hullPoints));
                //         d.groupSize = d.child1.groupSize + d.child2.groupSize;
                //         d.x = d.px = (d.child1.groupSize*d.child1.x + d.child2.groupSize*d.child2.x)/d.groupSize;
                //         d.y = d.py = (d.child1.groupSize*d.child1.y + d.child2.groupSize*d.child2.y)/d.groupSize;

                //      // +1.0 keeps the nodes from being perfectly on top of one another
                //      // ...something the force layout does not like even with 0 charge on the group nodes
                //     } else if (d.child1.visible) {
                //         d.groupSize = d.child1.groupSize;
                //         d.x = d.px = d.child1.x+1.0;
                //         d.y = d.py = d.child1.y+1.0;
                //         d.hullPoints = d.child1.hullPoints;

                //     } else {
                //         d.groupSize = d.child2.groupSize;
                //         d.x = d.px = d.child2.x+1.0;
                //         d.y = d.py = d.child2.y+1.0;
                //         d.hullPoints = d.child2.hullPoints;
                //     }

                //     return "M" + d.hullPoints.join("L") + "Z";
                // });

                // Update the links
                linkLines.attr('d', function(d) {
                    var s = line([
                        [d.source.x, d.source.y],
                        [(d.source.x+d.target.x)/2.0, (d.source.y+d.target.y)/2.0],
                        [d.target.x, d.target.y]
                    ]);
                    return s;
                });

                linkClips.select('path').attr('d', function(d) {

                    // find the intersect line and move it in by the width of the source element
                    // var line = polygonIntersectLine(d.source.hullPoints, d.source.x, d.source.y, d.target.x, d.target.y);
                    // var dx = line1[0][0] - line1[1][0]; //polygonIntersectLine(d.source.hullPoints, d.source.x, d.source.y, d.target.x, d.target.y)
                    // var dy = line1[0][1] - line1[1][1];
                    // var len = Math.sqrt(dx*dx + dy*dy);
                    // dx /= len;
                    // dy /= len;
                    // line1[0][0] += dx;
                    // line1[0][1] += dy;
                    // line1[1][0] += dx;
                    // line1[1][1] += dy;


                    // Find the sides of the source target hulls where we intersect and then clip so we appear to fall behind them
                    // var clipPoly = polygonIntersectLine(d.source.hullPoints, d.source.x, d.source.y, d.target.x, d.target.y)
                    //     .concat(polygonIntersectLine(d.target.hullPoints, d.source.x, d.source.y, d.target.x, d.target.y));
                    //console.log(clipPoly.join(" "));
                    //return d.source.hullPoints.concat(d.target.hullPoints).join(" "); ///
                    return "M" + d.source.hullPoints.join("L") + "Z";
                    //return clipPoly.join(" ");
                });

                linkClips.select('path:last-child').attr('d', function(d) {

                    return "M" + d.target.hullPoints.join("L") + "Z";
                    //return clipPoly.join(" ");
                });

                nodeLabels
                    .attr('x', function(d) { return d.x-d.halfTextWidth+d.labelShift; })
                    .attr('y', function(d) { return d.y-(d.selected ? -2 : d.highlight ? 0 : 0); });

                nodeSublabels
                    .attr('x', function(d) { return d.x-d.halfTextWidth+d.sublabelShift; })
                    .attr('y', function(d) { return d.y+(d.selected ? 13 : d.highlight ? 9 : 8); });

                firstTick = false;
            });

            // force.on('start', function() {
            //     console.log("START")

            //     //force.alpha(0);
            // });


		};

		// listen for updates
		scope.$on('graphChange', scope.buildGraph);
	}
};});
