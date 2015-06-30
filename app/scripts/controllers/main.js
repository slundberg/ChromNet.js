'use strict';

/**
 * @ngdoc function
 * @name linkClientApp.controller:MainCtrl
 * @description
 * # MainCtrl
 * Controller of the linkClientApp
 */
angular.module('linkClientApp').controller('MainCtrl', ['$scope', '$http', function ($scope, $http) {
    $scope.threshold = 1; // currently a negative log base 10 p-value
    
    $scope.sourceFile = 'http://storage.googleapis.com/link-uw-human/network_rank99_0.7G_3_25_15_groupgm.json';
    //$scope.sourceFile = 'http://storage.googleapis.com/link-uw-human/network_0.7G_2_10_15_groupgm.json';
    //$scope.sourceFile = '/graph_data/network.json';
    $scope.trackId = "ENCSR000DMS";
    $scope.sharedZoom = {};
    $scope.maxMatches = 300; // limit to save the browser from plotting too many matches and getting slow
    $scope.selectedTrack = undefined;
    $scope.selectedTrackUUID = undefined;
    $scope.selectedTrackColor = undefined;
    //$scope.showCrossLinks = $.cookie('showCrossLinks') === undefined ? true : $.cookie('showCrossLinks') === "true";
    $scope.includeNearby = $.cookie('includeNearby') === undefined ? true : $.cookie('includeNearby') === "true";
    //console.log("test", $scope.showCrossLinks, $scope.includeNearby);
    $scope.searchString = $.cookie('searchString') === undefined ? "" : $.cookie('searchString');
    $scope.allTypes = {}; // a way to map types to unique integers
    $scope.groupedType = "cellTypeAndTreatments";
    $scope.groupedTypeNames = {
        "cellType": "Cell Types",
        "organism": "Organisms",
        "lab": "Labs",
        "treatments": "Treatments",
        "lifeStage": "Life Stages",
        "cellTypeAndTreatments": "Cell Types and Treatments"
    };
    $scope.defaultUploadStatusMessage = "Drop custom network JSON files here for visualization.";
    $scope.uploadStatusMessage = $scope.defaultUploadStatusMessage;

    // for debugging access
    window.mainScope = $scope;

    $scope.markBioGRIDEdges = true;

    // keeps the selected track settings in sync with the current search
    function updateSelectedTrack() {
        if ($scope.selectedTrack && $scope.selectedTrack.uuid !== $scope.selectedTrackUUID) {
            if (!$scope.selectedTrack.annotationSymbol) {
                $http.get("http://mygene.info/v2/query?q="+$scope.selectedTrack.name).success(_.partial(loadMetaData, $scope.selectedTrack));
            }

            var type = $scope.typeMap[$scope.selectedTrack.data[$scope.groupedType]];
            if (type) {
                $scope.selectedTrackColor = d3.rgb(type.color);
            } else {
                $scope.selectedTrackColor = undefined;
            }

            $scope.selectedTrackUUID = $scope.selectedTrack.uuid;
            $scope.filterGraph();

        } else if (!$scope.selectedTrack && $scope.selectedTrackUUID) {
            $scope.selectedTrackUUID = undefined;
            $scope.filterGraph();
        }
    }

    var logPageView = _.debounce(function(url) {
        ga('send', 'pageview', url);
        //console.log("logged", url)
    }, 1000);

    // watch the external and user controlled options
    $scope.$watch('threshold', function() {
        if ($scope.graph) $scope.filterGraph();
    });
    // $scope.$watch('showCrossLinks', function() {
    //     $.cookie('showCrossLinks', $scope.showCrossLinks, { expires: 90 });
    //     if ($scope.graph) $scope.filterGraph();
    //     updateSelectedTrack();
    // });
    $scope.$watch('groupedType', function() {
        if ($scope.graph) $scope.filterGraph();
    });
    $scope.$watch('includeNearby', function() {
        $.cookie('includeNearby', $scope.includeNearby, { expires: 90 });
        console.log("includeNearby", $scope.includeNearby);
        if ($scope.graph) $scope.filterGraph();
        updateSelectedTrack();
    });
    $scope.$watch('markBioGRIDEdges', function() {
        if ($scope.graph) $scope.filterGraph();
    });
    $scope.$watch('searchString', function() {
        logPageView("/search/"+encodeURIComponent($scope.searchString));
        //console.log("ASDFSDF", $scope.searchString)
        $.cookie('searchString', $scope.searchString, { expires: 90 });
        if ($scope.graph) $scope.filterGraph();
        updateSelectedTrack();
    });
    $scope.$watch('sourceFile', function() {
        $http.get($scope.sourceFile).success(function(graph) {
             $scope.newGraph(graph);
        });
    });
    $scope.$watch('selectedTrack', updateSelectedTrack);

    function handleFileSelect(evt) {
        evt.stopPropagation();
        evt.preventDefault();

        if (evt.dataTransfer.files.length > 1) {
            $scope.uploadErrorMessage = "Please only upload a single JSON file!";
            return;
        }

        $scope.uploadStatusMessage = "Loading custom network...";
        //$scope.uploadColor = "#5bc0de";

        var file = evt.dataTransfer.files[0];
        var reader = new FileReader();
        reader.onload = (function(theFile) {
            return function(e) {
                $scope.newGraph(JSON.parse(e.target.result));
                $scope.uploadColor = "#5cb85c";
                $scope.uploadStatusMessage = "Custom network loaded."
                $scope.customData = true;
                _.delay(function() {
                    $scope.uploadStatusMessage = $scope.defaultUploadStatusMessage;
                    $scope.uploadColor = "";
                    $scope.$digest();
                }, 5000);
                $scope.$digest();
            };
        })(file);
        reader.readAsText(file);

        $scope.$digest();
    }
    function handleDragOver(evt) {
        evt.stopPropagation();
        evt.preventDefault();
        evt.dataTransfer.dropEffect = 'copy'; // Explicitly show this is a copy.
    }
    // Setup the dnd listeners.
    var dropZone = document.getElementById('customNetworkDropZone');
    dropZone.addEventListener('dragenter', function(evt) {
        $scope.uploadColor = "#000";
        $scope.$digest();
    }, false);
    dropZone.addEventListener('dragleave', function() {
        $scope.uploadColor = "";
        $scope.$digest();
    }, false);
    dropZone.addEventListener('dragover', function(evt) {
        evt.stopPropagation();
        evt.preventDefault();
        evt.dataTransfer.dropEffect = 'copy'; // Explicitly show this is a copy.
    }, false);
    dropZone.addEventListener('drop', handleFileSelect, false);


    function download(filename, text) {
        var pom = document.createElement('a');
        pom.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
        pom.setAttribute('download', filename);

        pom.style.display = 'none';
        document.body.appendChild(pom);

        pom.click();

        document.body.removeChild(pom);
    }

    // recursively build a list of all child values
    function childValues(node, valueFunc) {
        if (node.group) {
            return childValues(node.child1, valueFunc) + "|" + childValues(node.child2, valueFunc);
        }
        return valueFunc(node);
    }

    function nodeValuesString(node) {
        var txt = childValues(node, function(n) { return n.uuid.replace(/_[0-9]+$/, ""); }) + "\t";
        txt += childValues(node, function(n) { return n.name; }) + "\t";
        txt += childValues(node, function(n) { return n.data.cellType; }) + "\t";
        txt += childValues(node, function(n) { return n.data.treatments; }) + "\t";
        txt += childValues(node, function(n) { return n.data.lab; }) + "\t";
        return txt;
    }

    $scope.downloadGraph = function() {
        var txt = "Experiment IDs 1\tNames 1\tCell Types 1\tTreatments 1\tLabs 1\t";
        txt +=    "Experiment IDs 2\tNames 2\tCell Types 2\tTreatments 2\tLabs 2\tGroup Interaction Magnitude\n";
        _.each($scope.presentedLinks, function(e) {
            if (e.source.name < e.target.name) {
                txt += nodeValuesString(e.source);
                txt += nodeValuesString(e.target);
            } else {
                txt += nodeValuesString(e.target);
                txt += nodeValuesString(e.source);
            }

            txt += e.coeff + "\n";
        });
        download($scope.searchString + " chromNet Graph.txt", txt);
    };

    $scope.addSearchTerm = function(term) {
        $scope.searchString += " "+term;
    };

    $scope.windowWidth = function() {
        return window.innerWidth;
    };

    $scope.windowHeight = function() {
        return window.innerHeight;
    };

    // This loads the annotation data for all the selected tracks
    function loadMetaData(track, results) {
        if (results.hits.length) $http.get("http://mygene.info/v2/gene/"+results.hits[0].entrezgene).success(function(data) {
            track.annotationSymbol = data.symbol;
            track.annotationSummary = data.summary;
        });
    }

    // $scope.loadSourceFile = function() {
    //     // Load the graph and then build it
    //     $http.get($scope.sourceFile).success(function(graph) {
    //          $scope.newGraph(graph);
    //     });
    // }

    $scope.newGraph = function(graph) {
        $scope.graph = graph;
        window.graph = graph;
        

        // Set up the ranges for the threshold
        var sortedPvals = _.sortBy(_.pluck($scope.graph.links, 'log10pval'));
        $scope.maxRangeBound = 2; //-sortedPvals[Math.min(100, Math.floor(sortedPvals.length/5))];
        $scope.minRangeBound = -sortedPvals[sortedPvals.length-1];
        $scope.threshold = 2.0; //-sortedPvals[Math.floor(sortedPvals.length/20)];

        // convert the link target and source indexes
        console.log($scope.graph.links.length);
        $scope.graph.links =_.filter($scope.graph.links, function(d) {
            d.source = $scope.graph.nodes[d.source];
            d.target = $scope.graph.nodes[d.target];
            d.score = Math.abs(d.coeff);
            d.coeff = -d.coeff;
            return d.source.groupScore > 0.7 && d.target.groupScore > 0.7;
        });
        console.log($scope.graph.links.length);
        console.log('graph', graph);

        // mark all nodes that are just controls
        // convert parent indexes to object references
        // create child references
        var controlRegExp = new RegExp('control', 'i');
        $scope.leafCount = 0;
        _.each($scope.graph.nodes, function(d) {
            if (d.nodeCount === undefined) d.nodeCount = 1;
            d.control = d.name.match(controlRegExp);
            d.parent = $scope.graph.nodes[d.parent];
            d.origParent = d.parent;
            d.origObj = d;
            if (d.data.treatments === "None") {
                d.data.cellTypeAndTreatments = d.data.cellType;
            } else {
                d.data.cellTypeAndTreatments = d.data.cellType + ", " + d.data.treatments;
            }
            if (d.parent) {
                if (d.parent.child1 === undefined) {
                    d.parent.child1 = d;
                    d.parent.nodeCount = d.nodeCount;
                } else {
                    if (d.parent.child1.data[$scope.groupedType] === d.data[$scope.groupedType]) {
                        d.parent.data[$scope.groupedType] = d.data[$scope.groupedType];
                    }
                    d.parent.child2 = d;
                    d.parent.nodeCount += d.nodeCount;
                }
            }
            
            if (d.child1) d.group = true;
            else $scope.leafCount += 1;

            // This allows any type to get mapped to a unique integer
            if (d.data[$scope.groupedType] !== undefined && !(d.data[$scope.groupedType] in $scope.allTypes)) {
                $scope.allTypes[d.data[$scope.groupedType]] = Object.keys($scope.allTypes).length;
            }
        });
        
        $scope.filterGraph();
    };

    //var markCounter = 0;
    $scope.filterGraph = function() {
		var g = $scope.graph;

	    // highlight all nodes that match the search string or are selected
	    var searchString = $scope.searchString === undefined ? '' : $scope.searchString;
        var regGroups = _.map(searchString.split("or"), function(v) {
            return _.map(_.filter(v.split(' '), function(d) {
                return d.length > 0;
            }), function(s) {
                if (s.length > 1 && s[0] === '-') {
                    return [false, new RegExp(s.substr(1), 'i')];
                } else {
                    return [true, new RegExp(s, 'i')];
                }
            });
        });
        for (var i = 0; i < g.nodes.length; ++i) {
            g.nodes[i].highlight = g.nodes[i].selected ? true : undefined;
        }
        $scope.typeMap = {};
        $scope.numMatches = 0;
        _.each(g.nodes, function(d) {
            //d.parent = d.origParent; // reset parent links from the last filter
            d.uuid = d.data.id;
            if ($scope.searchString && !d.highlight && !d.group) {
                for (var i = 0; i < regGroups.length; ++i) { // OR
                    var found = regGroups[i].length > 0;
                    for (var j = 0; j < regGroups[i].length; ++j) { // AND
                        var r = regGroups[i][j][1];
                        if (regGroups[i][j][0]) { // match sense regular not inverted
                            if (!d.name.match(r) && !d.data.description.match(r) && !d.data.id.match(r) && !d.data.cellType.match(r)) {
                                found = false;
                                break;
                            }
                        } else {
                            if (d.name.match(r) || d.data.description.match(r) || d.data.id.match(r) || d.data.cellType.match(r)) {
                                found = false;
                                break;
                            }
                        }
                    }

                    if (found) {

                        // We break out early if we get too many nodes
                        $scope.numMatches += 1;
                        if ($scope.numMatches > $scope.maxMatches) {
                            console.log("too many");
                            return false;
                        }

                        d.highlight = true;

                        // Collect all the cell types that have been found
                        if (d.data[$scope.groupedType] !== undefined && !(d.data[$scope.groupedType] in $scope.typeMap)) {
                            $scope.typeMap[d.data[$scope.groupedType]] = 0;
                        }
                        break;
                    }
                }
            }

            if (d.highlight && d.parent) d.parent.highlight = true;
        });
        var typeNames = Object.keys($scope.typeMap); //["K562"];//
        typeNames.sort();

        // Make sure we don't exceed the display limit early
        if ($scope.numMatches > $scope.maxMatches) {
            $scope.presentedNodes = [];
            $scope.presentedLinks = [];
            $scope.types = [];
            _.defer(function() { $scope.$broadcast('graphChange'); }); 
            return;
        }

        // Assign colors to each cell type
        var colors = $scope.buildColorSet(typeNames.length);
        $scope.types = [];
        for (i = 0; i < typeNames.length; ++i) {
            var type = {'name': typeNames[i], 'color': colors[i], 'lightColor': $scope.whiter(colors[i], 0.6)};
            $scope.types.push(type);
            $scope.typeMap[typeNames[i]] = type;
        }

        // mark which links pass our thresholds (or fail a filter)
        _.each(g.links, function(d) {
            d.passedThreshold = d.score > $scope.threshold && d.source.groupScore > 0.7 && d.target.groupScore > 0.7;

            if ($scope.markBioGRIDEdges && d.labels.indexOf("BioGRID") > -1) d.marked = true;
            else d.marked = undefined;
        });

        // Mark all nodes nearby links that pass our thresholds
        function markNearby(graph) {
            
            // mark all node with the same name as the selected track "nearby"
            if ($scope.selectedTrack) for (i = 0; i < graph.nodes.length; ++i) {
                if ($scope.selectedTrack.name === graph.nodes[i].name) {
                    graph.nodes[i].nearby = true;
                }
            }

            // lay down marks
            _.each(graph.links, function(d) {
                if (d.passedThreshold && (d.source.highlight || d.target.highlight)) {
                    d.target.nearby = true;
                    d.source.nearby = true;
                }
            });

            // propagate marks down from parents
            for (i = graph.nodes.length-2; i >= 0; --i) {
                if (graph.nodes[i].parent.nearby) graph.nodes[i].nearby = true;
            }

            // propagate marks up
            for (i = 0; i < graph.nodes.length; ++i) {
                if (graph.nodes[i].nearby && graph.nodes[i].parent) {
                    graph.nodes[i].parent.nearby = true;
                }
            }
        }

        // clear previous nearby marks
        for (var i = 0; i < graph.nodes.length; ++i) {
            graph.nodes[i].nearby = undefined;
        }
        
        // mark nearby nodes and children of nearby nodes
        if ($scope.includeNearby) markNearby(g);

        // remove all the nodes and edges that are below the threshold or not highlighted/nearby
        function removeNonMatches(graph) {
            return {
                nodes: _.filter(graph.nodes, function(d) { return d.highlight || d.nearby; }),
                links: _.filter(graph.links, function(d) {
                    d.lighten = !d.source.highlight && !d.target.highlight;
                    return d.passedThreshold && (d.source.highlight || d.source.nearby) && (d.target.highlight || d.target.nearby);
                })
            };
        }

        var fg = removeNonMatches(g);

        // This clones all the nodes and links in the given graph (making a copy)
        function cloneGraph(graph) {
            var newGraph = {};
            newGraph.nodes = _.map(graph.nodes, function(d) {
                var c = d.lastClone = _.clone(d);

                if (c.child1) {
                    c.child1 = c.child1.lastClone;
                    if (c.child1) c.child1.parent = c;
                }
                if (c.child2) {
                    c.child2 = c.child2.lastClone;
                    if (c.child2) c.child2.parent = c;
                }
                return c;
            });

            newGraph.links = _.map(graph.links, function(d) {
                var c = d.lastClone = _.clone(d);
                c.target = c.target.lastClone;
                c.source = c.source.lastClone;

                return c;
            });

            // Remove our lastClone pointers so we leave the orignal graph unchanged
            _.each(graph.nodes, function(d) { delete d.lastClone; });

            return newGraph;
        }

        // This filters out all the links and nodes do not match the given type
        function filterGraphByType(graph, type) {
            var newGraph = {};
            newGraph.nodes = _.filter(graph.nodes, function(d) {
                if (!d.type) d.type = d.data[$scope.groupedType];
                d.uuid = d.data.id + "_" + $scope.allTypes[d.type];
                d.typeMatch = d.type === type;
                if (d.parent && d.typeMatch) d.parent.type = type;
                if (d.child1 && !d.child1.typeMatch) d.child1 = undefined;
                if (d.child2 && !d.child2.typeMatch) d.child2 = undefined;
                return d.typeMatch;
            });

            newGraph.links = _.filter(graph.links, function(d) {
                return (d.source.typeMatch && d.target.typeMatch);
            });

            // Remove our typeMatch markers so we leave the orignal graph unchanged
            _.each(graph.nodes, function(d) { delete d.typeMatch; });

            // Re-calculate who is nearby and prune
            if ($scope.includeNearby) markNearby(newGraph);

            return removeNonMatches(newGraph);
        }

        // This prunes out all the weak parents in the graph (those parents with less than 2 children)
        function pruneWeakParents(graph) {

            // make each side of all links sink below all parents with one child
            var newGraph = {};
            newGraph.links = _.each(graph.links, function(d) {
                while (true) {
                    if (d.source.child1 && !d.source.child2) {
                        d.source = d.source.child1;
                    } else if (d.source.child2 && !d.source.child1) {
                        d.source = d.source.child2;
                    } else if (d.target.child1 && !d.target.child2) {
                        d.target = d.target.child1;
                    } else if (d.target.child2 && !d.target.child1) {
                        d.target = d.target.child2;
                    } else break;
                }
            });

            // remove all parents with less than two children and patch up the tree pointers
            newGraph.nodes = _.filter(graph.nodes, function(d) {
                if (d.group) {

                    if (!d.child1 && !d.child2) {
                        d.highlight = d.nearby = false;
                        if (d.parent) {
                            if (d.parent.child1 === d) d.parent.child1 = undefined;
                            else if (d.parent.child2 === d) d.parent.child2 = undefined;
                        }
                        return false;
                    }

                    if (d.child1 && !d.child2) {
                        d.highlight = d.nearby = false;
                        if (d.parent) {
                            if (d.parent.child1 === d) d.parent.child1 = d.child1;
                            else if (d.parent.child2 === d) d.parent.child2 = d.child1;
                        }
                        d.child1.parent = d.parent;
                        return false;
                    }

                    if (d.child2 && !d.child1) {
                        d.highlight = d.nearby = false;
                        if (d.parent) {
                            if (d.parent.child1 === d) d.parent.child1 = d.child2;
                            else if (d.parent.child2 === d) d.parent.child2 = d.child2;
                        }
                        d.child2.parent = d.parent;
                        return false;
                    }
                }
                return true;
            });
            
            return newGraph;
        }

        // find and remove all higher redundant edges
        function filterRedundantEdges(graph) {
            for (var i = 0; i < graph.links.length; ++i) graph.links[i].tmpMark = -2;
            for (i = 0; i < graph.links.length; ++i) {
                var l = graph.links[i];
                if (l.tmpMark === -1) continue;

                // the source and target and all parents
                var node = l.source;
                while (node) {
                    node.tmpMark = i;
                    node = node.parent;
                }
                node = l.target;
                while (node) {
                    node.tmpMark = i;
                    node = node.parent;
                }

                // mark all redundant higher links
                for (var j = 0; j < graph.links.length; ++j) {
                    var l2 = graph.links[j];
                    if (l2 !== l && l2.source.tmpMark === i && l2.target.tmpMark === i) {
                        l2.tmpMark = -1;
                    }
                }
            }

            // throw out everything labeled redundant
            graph.links = _.reject(graph.links, {tmpMark: -1});

            return graph;
        }

        // compute the levels of the nodes in a graph
        function computeLevels(graph) {
            _.each(graph.nodes, function(d) {
                if (!d.child1 && !d.child2) d.level = 0;
                else if (d.child1 && d.child2) d.level = Math.max(d.child1.level, d.child2.level) + 1;
                else if (d.child1) d.level = d.child1.level;
                else d.level = d.child2.level;
            });
            return graph;
        }

        // Build a tree network for every cell type
        $scope.presentedNodes = [];
        $scope.presentedLinks = [];
        _.each(typeNames, function(type) {
            var typeGraph = pruneWeakParents(filterGraphByType(cloneGraph(fg), type));
            filterRedundantEdges(typeGraph);
            computeLevels(typeGraph);
            
            Array.prototype.push.apply($scope.presentedNodes, typeGraph.nodes);
            Array.prototype.push.apply($scope.presentedLinks, typeGraph.links);
        });

        // Make sure we don't exceed the display limit
        $scope.numMatches = $scope.presentedNodes.length;
        if ($scope.numMatches > $scope.maxMatches) {
            $scope.presentedNodes = [];
            $scope.presentedLinks = [];
        }

        // Keep the selected track selected after rebuilding the graph (just updating the pointer caused loopy reference problems)
        if ($scope.selectedTrack) for (i = 0; i < $scope.presentedNodes.length; ++i) {
            if ($scope.presentedNodes[i].uuid === $scope.selectedTrackUUID) {
                $scope.presentedNodes[i].selected = true;
            }
        }
        
        // defer so the digest can complete and the directive will be in sync with the updated scope variables
        _.defer(function() { $scope.$broadcast('graphChange'); }); 
    };

    // This creates a unique and hopefully pleasent set of ordered colors
    $scope.buildColorSet = function(numColors) {
    	
        var colors = [d3.rgb(27, 113, 241), d3.rgb(83, 191, 15), d3.rgb(219, 139, 0), d3.rgb(204, 24, 24), d3.rgb(161, 117, 191)];

        // Create a polylinear color scale that interpolates between all the given colors when we run out
        var numUniqueColors = Math.min(numColors, colors.length);

        // This fits all the type indexes into the possibly smaller color indexes
        var q = d3.scale.quantize().domain(_.range(numColors)).range(_.range(numUniqueColors-1));
        var tmp = _.map(_.range(numColors), q);

        // Now we see how many of each type index fell in between each color
        var backMap = _.map(_.range(numUniqueColors-1), function(d) { return tmp.indexOf(d); });
        backMap.push(numColors-1);

        // Build the poly linear scale
        var color = d3.scale.linear()
            .domain(backMap)
            .range(colors)
            .interpolate(d3.interpolateHcl);

        return _.map(_.range(numColors), color);
    };

    $scope.whiter = function(c, amount) {
        c = d3.rgb(c);
        return d3.rgb(c.r+(255-c.r)*amount, c.g+(255-c.g)*amount, c.b+(255-c.b)*amount);
    };
}]);
