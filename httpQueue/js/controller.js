var myApp = angular.module('myApp', []), i = 0, j = 0;

function httpQueueProvider() {
	var queue = [], i = 0, timer, multiple = 4, total = 0, interval = 100, $$timeout, $$http, $$log;

	function success(response) {
		$$log.info(response.config.id + ' resolved', response.config.deferred.promise.id);
		response.config.deferred.resolve(response);
	}

	function error(response) {
		$$log.info(response.config.id + ' rejected', response.config.deferred.promise.id);
		response.config.deferred.reject(response);
	}

	function consume() {
		for (var i = 0, c = multiple, l = queue.length, j, m, reqs, deferred; i < l; i += 1) {
			if ((reqs = queue[i])) {
				for (j = 0, m = reqs.length; j < m; j += 1) {
					c -= 1;
					total -= 1;
					cfg = reqs.shift();
					$$log.info(cfg.id + ' request');
					$$http(cfg).then(success, error);
					if (!c) {
						if (total) {
							timer = $$timeout(consume, interval);
						}
						return;
					}
				}
			}
		}
		$$timeout.cancel(timer);
		timer = null;
	}

	this.$get = ['$http', '$q', '$timeout', '$log', function($http, $q, $timeout, $log) {
		$$http = $http;
		$$timeout = $timeout;
		$$log = $log;

		// 0: high priority for special actions like 'login'
		// 1: normal actions
		// 2: low priority actions
		// 5: special, needs to execute in another worker
		function request(config) {
			var cfg = angular.extend({id: i += 1}, config);
			if (cfg.block) {
				return $http(cfg);
			}
			var deferred = cfg.deferred = $q.defer(), promise = deferred.promise, p = cfg.priority = +cfg.priority || 1;
			p += 5;
			(queue[p] || (queue[p] = [])).push(cfg);
			total += 1;
			if (!timer) {
				timer = $timeout(consume, interval);
			}
			promise.id = i;
			promise.success = function(fn) {
				promise.then(function(response) {
					fn(response.data, response.status, response.headers, config);
				});
				return promise;
			};

			promise.error = function(fn) {
				promise.then(null, function(response) {
					fn(response.data, response.status, response.headers, config);
				});
				return promise;
			};
			return promise;
		}

		request.globalConfig = function(config) {
			multiple = config.multiple > 4 ? config.multiple : 4;
			interval = +config.interval;
		};
		request.cancel = function(id) {
			for (var i = 0, l = queue.length, j, m, reqs; i < l; i += 1) {
				if ((reqs = queue[i])) {
					for (j = 0, m = reqs.length; j < m; j += 1) {
						if (reqs[j][0] === id) {
							total -= 1;
							reqs.splice(j, 1);
							return;
						}
					}
				}
			}
		};
		request.get = function(url, config) {
			if (!config) { config = {}; }
			config.url = url;
			config.method = 'GET';
			return config.block ? $http(config) : request(config);
		};
		request.post = function(url, data, config) {
			if (!config) { config = {}; }
			config.url = url;
			config.method = 'POST';
			config.data = data;
			return config.block ? $http(config) : request(config);
		};

		return request;
	}];
}

myApp.provider('httpQueue', httpQueueProvider);

myApp.controller('NetworkCtrl', ['$scope', 'httpQueue', function($scope, httpQueue) {
	$scope.test = function() {
		var l = 10, data = $scope.data = [], fn = function (result) {
			$scope.data.push({name : result, time : new Date()});
		};
		while ((l -= 1)) {
			httpQueue.get('http://localhost/one-piece/test/asset/test.txt').success(fn);
		}
		$scope.l = data.length;
	};
}]);