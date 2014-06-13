	
	var defaultErrorHandler = function(e){
		if(typeof e == 'object' && typeof e.target.error != 'undefined'){
			console.log(e.target.error);
		}else{
			console.log(e);
		}
	};

	var defaultSuccessHandler = function(e){
	};
	
	var defaults = {
			version: 1,
			onReady: function () {
			},
			onError: defaultErrorHandler,
			storeName: null,
			debug: false,
			upgradeInfo:[]
		};
	
	function HandbookIDB(name, options){
		var env = typeof window == 'object' ? window : self;
		this.idb = env.indexedDB || env.webkitIndexedDB || env.mozIndexedDB;
		this.keyRange = env.IDBKeyRange || env.webkitIDBKeyRange || env.mozIDBKeyRange;
		this.name = name || null;
		if(!this.name){
			defaultErrorHandler('Database name is required!');
			return;
		}
		for (var key in defaults) {
			this[key] = typeof options[key] != 'undefined' ? options[key] : defaults[key];
		}
		this.openDB();
	}

	HandbookIDB.prototype.transactionBegin = false;
	HandbookIDB.prototype.transactionOperations = [];
	HandbookIDB.prototype.transactionStoreNames = [];
	HandbookIDB.prototype.transactionObj = null;
	
	HandbookIDB.prototype.log = function(message){
		if(this.debug){
			console.log(message);
		}
	};
	
	HandbookIDB.prototype.openDB = function(){
		var request = this.idb.open(this.name, this.version);
		request.onblocked = function(e) {
			this.log('request.onblocked');
			// If some other tab is loaded with the database, then it needs to be closed
			// before we can proceed.
			alert("Please close all other tabs with this site open!");
		}.bind(this);
		request.onupgradeneeded = function(e){
			this.onupgradeneeded(e);
		}.bind(this);
		request.onsuccess = function(e){
			this.db = this.db || e.target.result;
			if(this.db){
				this.log('open db ok');
				this.log(this.db);
				this.useDatabase(this.db);
			}else{
				this.log('can not open db');
			}
		}.bind(this);
		request.onerror = function(e) {
			this.onError(e);
		}.bind(this);
	};

	HandbookIDB.prototype.useDatabase = function(db){
		this.log('HandbookIDB.prototype.useDatabase');
		// Make sure to add a handler to be notified if another page requests a version
		// change. We must close the database. This allows the other page to upgrade the database.
		// If you don't do this then the upgrade won't happen until the user closes the tab.
		db.onversionchange = function(e) {
			db.close();
			alert("A new version of this page is ready. Please reload!");
		};

		this.onReady();
	};
	
	/*HandbookIDB.prototype.onupgradeneeded = function(e){
		this.log('HandbookIDB.prototype.onupgradeneeded');
		this.db = e.target.result;
		switch(this.version){
		case 1:
			var store = this.db.createObjectStore("books", {keyPath:"id", autoIncrement: true});
			store.createIndex('userid','userid',{unique:false});
			store.createIndex('category','category',{unique:false}); 
			break;
		case 53:
			console.log('--53--');
		default:
			console.log('--default--');
			break;
		}
	};*/

	HandbookIDB.prototype.onupgradeneeded = function(e){
		this.log('HandbookIDB.prototype.onupgradeneeded');
        this.db = event.target.result;
        this.upgradeInfo.forEach(function(upgradeParameter){
			if(this.db.objectStoreNames&&this.db.objectStoreNames.contains(upgradeParameter.storeName)){
          		this.store = event.target.transaction.objectStore(upgradeParameter.storeName);
        	} else {
          		var optionalParameters = { autoIncrement: upgradeParameter.autoIncrement };
          		if (upgradeParameter.keyPath !== null) {
            		optionalParameters.keyPath = upgradeParameter.keyPath;
          		}
          		this.store = this.db.createObjectStore(upgradeParameter.storeName, optionalParameters);
        	}

        	upgradeParameter.indexes.forEach(function(indexParameter){
          		var indexName = indexParameter.name;
          		if(!indexName){
            		this.onError(new Error('Cannot create index: No index name given.'));
          		}
          		if(this.store.indexNames.contains(indexName)){

          		} else {
            		this.store.createIndex(indexName, indexName, { unique: indexParameter.unique });
          		}
        	}, this);
        },this);
      };

    HandbookIDB.prototype.deleteDatabase=function(dbName){
		this.idb.deleteDatabase(dbName);
    }
	
	HandbookIDB.prototype.begin = function(){
		this.log('HandbookIDB.prototype.begin');
		this.transactionBegin = true;
	};
	
	HandbookIDB.prototype.commit = function(options){
		this.log('HandbookIDB.prototype.commit');
		//reset transactionBegin to false
		this.transactionBegin = false;
		options = mixin({
			onComplete: function(e){},
			onError: defaultErrorHandler
		}, options);
		
		if(this.transactionOperations){
			var transactionOperations = this.transactionOperations;
			var transactionStoreNames = this.transactionStoreNames;
			this.transactionOperations = [];
			this.transactionStoreNames = [];
			var flag = true;
			var transaction = this.db.transaction([transactionStoreNames], 'readwrite');
			var self = this;
			transactionOperations.forEach(function(operation){
				if(!flag){
					return;
				}
				operation.options.transaction = transaction;
				operation.options.storeName = transactionStoreNames;
				switch(operation.type){
					case 'save':
						flag = self.save(operation.data, operation.options);
						break;
					case 'update':
						flag = self.update(operation.key, operation.data, operation.options);
						break;
					case 'remove':
						flag = self.remove(operation.key, operation.options);
						break;
					default:
						break;
				}
			});
			if(!flag){
				transaction.abort();
			}
			transaction.oncomplete = function(e){
				console.log('transaction.oncomplete');
				options.onComplete(e);
			}.bind(this);
			transaction.onabort = function(e){
				console.log('transaction.onabort');
				options.onError(e);
			}.bind(this);
			transaction.onerror = function(e){
				this.log('transaction.onerror');
				options.onError(e);
			}.bind(this);
		}
	};
	
	/**
	 * Retrieves an object from the store by key. If no entry exists with the given id,
	 * the success handler will be called with null as first and only argument.
	 *
	 * @param {*} key                               The id of the object to fetch.
	 * @param {Object} options
	 * @param {String or Array} [options.storeName] Which store can be operation.
	 * @param {Function} [options.onSuccess]        A callback that is called if fetching was successful.
	 * @param {Function} [options.onError]          A callback that will be called if an error occurred during the operation.
	 * @returns {Transaction}                       The transaction used for this operation.
	 */
	HandbookIDB.prototype.get = function(key, options){
		this.log('HandbookIDB.prototype.get');
		options = mixin({
			storeName: this.storeName,
			onSuccess: defaultSuccessHandler,
			onError: defaultErrorHandler
		}, options);
		
		var flag = false,
			result = null;
		
		var transaction = this.db.transaction([options.storeName]);
		var store = transaction.objectStore(options.storeName);
		transaction.oncomplete = function(){
			this.log('transaction.oncomplete');
			flag ? options.onSuccess(result) : options.onError(result);
		}.bind(this);
		transaction.onerror = options.onError;
		transaction.onabort = options.onError;
		
		var request = store.get(key);
		request.onsuccess = function(e){
			this.log('request.onsuccess');
			result = e.target.result;
			flag = true;
		}.bind(this);
		request.onerror = function(e){
			this.log('request.onerror');
		}.bind(this);
		
		return transaction;
	};
	
	/**
	 * Retrieves an object from the store by index.
	 *
	 * @param {String} index                        The name of index to fetch.
	 * @param {*} value                             The value of index to fetch.
	 * @param {Object} options
	 * @param {String or Array} [options.storeName] Which store can be operation.
	 * @param {Function} [options.onSuccess]        A callback that is called if operation was successful.
	 * @param {Function} [options.onError]          A callback that will be called if an error occurred during the operation.
	 * @returns {Transaction}                       The transaction used for this operation.
	 */
	HandbookIDB.prototype.getByIndex = function(index, value, options){
		this.log('HandbookIDB.prototype.getByIndex');
		options = mixin({
			storeName: this.storeName,
			onSuccess: defaultSuccessHandler,
			onError: defaultErrorHandler
		}, options);
		
		var flag = false,
			result = null;
		
		var transaction = this.db.transaction([options.storeName]);
		var store = transaction.objectStore(options.storeName);
		transaction.oncomplete = function(){
			this.log('transaction.oncomplete');
			flag ? options.onSuccess(result) : options.onError(result);
		}.bind(this);
		transaction.onabort = options.onError;
		transaction.onerror = options.onError;
		
		if(!store.indexNames.contains(index)){
			transaction.abort();
			options.onError('Index:'+index+' is not exist!');
			return;
		}
		var index = store.index(index);
		var request = index.get(value);
		request.onsuccess = function(e){
			this.log('request.onsuccess');
			result = e.target.result;
			flag = true;
		}.bind(this);
		request.onerror = function(e){
			this.log('request.onerror');
		}.bind(this);
		
		return transaction;
	};

	/**
	 * Retrieves an object or some objects from the store by conditions.
	 *
	 * @param {String} type                         Fetch first object or all objects(first or all).
	 * @param {Object} options
	 * @param {String or Array} [options.storeName] Which store can be operation.
	 * @param {String} [options.index]              The index name used to fetch
	 * @param {String} [options.order]              ASC or DESC, default ASC
	 * @param {Integer} [options.offset]            Default 0
	 * @param {Integer} [options.limit]             Default null
	 * @param {Integer} [options.page]
	 * @param {Boolean} [options.filterDuplicates]  Filter duplicate data
	 * @param {Object} [options.keyRange]
	 * @param {Function} [options.onSuccess]        A callback that is called if operation was successful.
	 * @param {Function} [options.onError]          A callback that will be called if an error occurred during the operation.
	 * @returns {Transaction}                       The transaction used for this operation.
	 */
	HandbookIDB.prototype.find = function(type, options){
		this.log('HandbookIDB.prototype.find');
		options = mixin({
			storeName: this.storeName,
			index: null,
			order: 'ASC',
			offset: 0,
			limit: null,
			page: null,
			filterDuplicates: false,
			keyRange: null,
			onSuccess: defaultSuccessHandler,
			onError: defaultErrorHandler
		}, options);
		if(isNaN(options.page) || options.page < 1){
			options.page = 1;
		}
		if(options.page > 1 && options.limit){
			options.offset = (options.page - 1) * options.limit;
		}
		type = type == 'first' ? 'first' : 'all';
		options.order = options.order.toLowerCase() == 'desc' ? 'prev' : 'next';
		if (options.filterDuplicates) {
			options.order += 'unique';
		}
		
		var flag = false,
			result = [];
		
		var transaction = this.db.transaction(options.storeName, 'readonly');
		var store = transaction.objectStore(options.storeName);
		if (options.index) {
			store = store.index(options.index);
		}
		transaction.oncomplete = function () {
			this.log('transaction.oncomplete');
			flag ? options.onSuccess(result) : options.onError(result);
		}.bind(this);
		transaction.onabort = options.onError;
		transaction.onerror = options.onError;
		
		var request = store.openCursor(options.keyRange, options.order);
		var count = total = 0;
		request.onsuccess = function(e){
			this.log('request.onsuccess');
			total++;
			var cursor = e.target.result;
			if (cursor) {
				if (type == 'all') {
					if(options.limit){
						if(options.offset < total && options.limit > count){
							result.push(cursor.value);
							count ++;
						}
						cursor['continue']();
					}else{
						result.push(cursor.value);
						cursor['continue']();
					}
				}else{
					result = cursor.value;
					flag = true;
				}
			} else {
				flag = true;
			}
		}.bind(this);
		request.onerror = function(e){
			this.log('request.onerror');
		}.bind(this);
		return transaction;
	};
	
	/**
	 * Count objects of the store by conditions.
	 *
	 * @param {Object} options
	 * @param {String or Array} [options.storeName] Which store can be operation.
	 * @param {String} [options.index]              The index name used to fetch
	 * @param {Object} [options.keyRange]
	 * @param {Function} [options.onSuccess]        A callback that is called if operation was successful.
	 * @param {Function} [options.onError]          A callback that will be called if an error occurred during the operation.
	 * @returns {Transaction}                       The transaction used for this operation.
	 */
	HandbookIDB.prototype.count = function (options) {
		this.log('HandbookIDB.prototype.count');
		options = mixin({
			storeName: this.storeName,
			index: null,
			keyRange: null,
			onSuccess: defaultSuccessHandler,
			onError: defaultErrorHandler
		}, options);

		var flag = false,
			result = null;

		var transaction = this.db.transaction([options.storeName], 'readonly');
		transaction.oncomplete = function () {
			this.log('transaction.oncomplete');
			flag ? options.onSuccess(result) : options.onError(result);
		}.bind(this);
		transaction.onabort = options.onError;
		transaction.onerror = options.onError;

		var store = transaction.objectStore(options.storeName);
		if (options.index) {
			store = store.index(options.index);
		}
		var request = store.count(options.keyRange);
		request.onsuccess = function(e){
			this.log('request.onsuccess');
			result = e.target.result;
			flag = true;
		}.bind(this);
		request.onError = function(e){
			this.log('request.onError');
		}.bind(this);

		return transaction;
	};
	
	/**
	 * Save data to store
	 *
	 * @param {Object} data                         The data need to save.
	 * @param {Object} options
	 * @param {String or Array} [options.storeName] Which store can be operation.
	 * @param {Function} [options.onSuccess]        A callback that is called if operation was successful.
	 * @param {Function} [options.onError]          A callback that will be called if an error occurred during the operation.
	 * @returns {Transaction}                       The transaction used for this operation.
	 */
	HandbookIDB.prototype._save = function(data, options){
		this.log('HandbookIDB.prototype._save');
		
		var flag = false,
		request = null,
		result = null;
	
		var transaction = this.db.transaction([options.storeName], 'readwrite');
		transaction.oncomplete = function () {
			this.log('transaction.oncomplete');
			flag ? options.onSuccess(result) : options.onError(result);
		}.bind(this);
		transaction.onabort = options.onError;
		transaction.onerror = options.onError;
		
		var store = transaction.objectStore(options.storeName);

		//check primary id
		if(store.keyPath == 'id' && store.autoIncrement && typeof data.id != 'undefined'){
			options.onError('Cannot insert auto increment column data');
			return false;
		}
		
		//check index
		var indexs = store.indexNames;
		for(var i=0; i<indexs.length; i++){
			if(typeof data[indexs[i]] == 'undefined'){
				options.onError('Data must include index column: '+indexs[i]);
				return false;
			}
		}
		
		if (options.key) { //out-of-line keys
			request = store.put(data, options.key);
		} else { //in-line keys
			request = store.put(data);
		}
		
		request.onsuccess = function (e) {
			this.log('request.onsuccess');
			result = e.target.result;
			flag = true;
		}.bind(this);
		request.onerror = function(e){
			this.log('request.onerror');
		}.bind(this);
		
		return transaction;
	};
	
	/**
	 * Save data to store with new transaction or outside transaction
	 *
	 * @param {Object} data                         The data need to save.
	 * @param {Object} options
	 * @param {String or Array} [options.storeName] Which store can be operation.
	 * @param {Function} [options.onSuccess]        A callback that is called if operation was successful.
	 * @param {Function} [options.onError]          A callback that will be called if an error occurred during the operation.
	 * @param {String} [options.transaction]        A transaction used for this operation which in outside.
	 * @returns {Transaction}                       The transaction used for this operation.
	 */
	HandbookIDB.prototype.save = function(data, options){
		this.log('HandbookIDB.prototype.save');
		options = mixin({
			storeName: this.storeName,
			onSuccess: defaultSuccessHandler,
			onError: defaultErrorHandler,
			transaction: this.transactionObj
		}, options);
		
		//this 'transactionBegin' flag is active in begin() function
		if(this.transactionBegin){
			if(options.storeName && !this.transactionStoreNames.contains(options.storeName)){
				this.transactionStoreNames.push(options.storeName);
			}
			this.transactionOperations.push({'type':'save', 'data':data, 'options':options});
			return;
		}
		
		//already have transaction, for example: batch operate
		if(options.transaction){
			var transaction = options.transaction;
			
			var store = transaction.objectStore(options.storeName);

			//check primary id
			if(store.keyPath == 'id' && store.autoIncrement && typeof data.id != 'undefined'){
				options.onError('Cannot insert auto increment column data');
				return false;
			}
			
			//check index
			var indexs = store.indexNames;
			for(var i=0; i<indexs.length; i++){
				if(typeof data[indexs[i]] == 'undefined'){
					options.onError('Data must include index column: '+indexs[i]);
					return false;
				}
			}
			
			if (options.key) { //out-of-line keys
				request = store.put(data, options.key);
			} else { //in-line keys
				request = store.put(data);
			}
			
			request.onsuccess = function (e) {
				this.log('request.onsuccess');
				this.transactionObj = transaction;
				options.onSuccess(e.target.result);
				this.transactionObj = null;
			}.bind(this);
			request.onerror = function(e){
				this.log('request.onerror');
			}.bind(this);
		}else{
			var transaction = this._save(data, options);
		}
		
		return transaction;
	};
	
	/**
	 * Update data by key
	 *
	 * @param {*} key                               The id need to update.
	 * @param {Object} data                         The data for update.
	 * @param {Object} options
	 * @param {String or Array} [options.storeName] Which store can be operation.
	 * @param {Function} [options.onSuccess]        A callback that is called if operation was successful.
	 * @param {Function} [options.onError]          A callback that will be called if an error occurred during the operation.
	 * @returns {Transaction}                       The transaction used for this operation.
	 */
	HandbookIDB.prototype._update = function(key, data, options){
		this.log('HandbookIDB.prototype._update');
		
		var flag = false,
			result = null,
			getResult = null;
		
		var transaction = this.db.transaction([options.storeName], 'readwrite');
		var store = transaction.objectStore(options.storeName);
		transaction.oncomplete = function () {
			this.log('transaction.oncomplete');
			flag ? options.onSuccess(result) : options.onError(result);
		}.bind(this);
		transaction.onabort = options.onError;
		transaction.onerror = options.onError;
		
		//delete primary id in data
		if(store.keyPath == 'id' && store.autoIncrement && typeof data.id != 'undefined'){
			delete data.id;
		}
		
		var getRequest = store.get(key);
		getRequest.onsuccess = function(e){
			this.log('getRequest.onsuccess');
			getResult = e.target.result;
			if(getResult){
				for( var k in data){
					getResult[k] = typeof data[k] != 'undefined' ? data[k] : getResult[k];
				}
				putRequest = store.put(getResult);
				putRequest.onsuccess = function (e) {
					this.log('putRequest.onsuccess');
					result = e.target.result;
					flag = true;
				}.bind(this);
				putRequest.onerror = function(e){
					this.log('putRequest.onerror');
				}.bind(this);
			}else{
				this.log('getResult is null');
				result = 'Cannot get record!';
			}
		}.bind(this);
		getRequest.onerror = function(e){
			this.log('getRequest.onerror');
		}.bind(this);
		return transaction;
	};
	
	/**
	 * Update data to store by key with new transaction or outside transaction
	 *
	 * @param {*} key                               The id need to save.
	 * @param {Object} data                         The data for save.
	 * @param {Object} options
	 * @param {String or Array} [options.storeName] Which store can be operation.
	 * @param {Function} [options.onSuccess]        A callback that is called if operation was successful.
	 * @param {Function} [options.onError]          A callback that will be called if an error occurred during the operation.
	 * @param {String} [options.transaction]        A transaction used for this operation which in outside.
	 * @returns {Transaction}                       The transaction used for this operation.
	 */
	HandbookIDB.prototype.update = function(key, data, options){
		this.log('HandbookIDB.prototype.update');
		options = mixin({
			storeName: this.storeName,
			onSuccess: defaultSuccessHandler,
			onError: defaultErrorHandler,
			transaction: this.transactionObj
		}, options);
		
		//this 'transactionBegin' flag is active in begin() function
		if(this.transactionBegin){
			if(options.storeName && !this.transactionStoreNames.contains(options.storeName)){
				this.transactionStoreNames.push(options.storeName);
			}
			this.transactionOperations.push({'type':'update', 'key': key, 'data':data, 'options':options});
			return;
		}
		
		//already have transaction, for example: batch operate
		if(options.transaction){
			var transaction = options.transaction;
			var store = transaction.objectStore(options.storeName);
			//delete primary id in data
			if(store.keyPath == 'id' && store.autoIncrement && typeof data.id != 'undefined'){
				delete data.id;
			}
			
			var getRequest = store.get(key);
			getRequest.onsuccess = function(e){
				this.log('getRequest.onsuccess');
				getResult = e.target.result;
				if(getResult){
					for( var k in data){
						getResult[k] = typeof data[k] != 'undefined' ? data[k] : getResult[k];
					}
					putRequest = store.put(getResult);
					putRequest.onsuccess = function(e){
						this.log('putRequest.onsuccess');
						this.transactionObj = transaction;
						options.onSuccess(e.target.result);
						this.transactionObj = null;
					}.bind(this);
					putRequest.onerror = function(e){
						this.log('putRequest.onerror');
					}.bind(this);
				}else{
					this.log('getResult is null');
					options.onError('Cannot get record!');
				}
			}.bind(this);
			getRequest.onerror = function(e){
				this.log('getRequest.onerror');
			}.bind(this);
		}else{
			var transaction = this._update(key, data, options);
		}
		
		return transaction;
	};
	
	/**
	 * Remove data by key
	 *
	 * @param {*} key                               The id need to remove.
	 * @param {Object} options
	 * @param {String or Array} [options.storeName] Which store can be fetched.
	 * @param {Function} [options.onSuccess]        A callback that is called if operation was successful.
	 * @param {Function} [options.onError]          A callback that will be called if an error occurred during the operation.
	 * @returns {Transaction}                       The transaction used for this operation.
	 */
	HandbookIDB.prototype._remove = function(key, options){
		this.log('HandbookIDB.prototype._remove');
		
		var flag = false,
			result = null;
		
		var transaction = this.db.transaction([options.storeName], 'readwrite');
		var store = transaction.objectStore(options.storeName);
		transaction.oncomplete = function () {
			flag ? options.onSuccess(result) : options.onError(result);
		};
		transaction.onabort = options.onError;
		transaction.onerror = options.onError;

		var request = store['delete'](key);
		request.onsuccess = function(e){
			this.log('request.onsuccess');
			result = e.target.result;
			if(result != 'undefined'){
				flag = true;
			}
		}.bind(this);
		request.onerror = function(e){
			this.log('request.onerror');
		}.bind(this);

		return transaction;
	};
	
	/**
	 * Remove data from store by key with new transaction or outside transaction
	 *
	 * @param {*} key                               The id need to save.
	 * @param {Object} options
	 * @param {String or Array} [options.storeName] Which store can be operation.
	 * @param {Function} [options.onSuccess]        A callback that is called if operation was successful.
	 * @param {Function} [options.onError]          A callback that will be called if an error occurred during the operation.
	 * @param {String} [options.transaction]        A transaction used for this operation which in outside.
	 * @returns {Transaction}                       The transaction used for this operation.
	 */
	HandbookIDB.prototype.remove = function(key, options){
		this.log('HandbookIDB.prototype.remove');
		options = mixin({
			storeName: this.storeName,
			onSuccess: defaultSuccessHandler,
			onError: defaultErrorHandler,
			transaction: this.transactionObj
		}, options);
		
		//this 'transactionBegin' flag is active in begin() function
		if(this.transactionBegin){
			if(options.storeName && !this.transactionStoreNames.contains(options.storeName)){
				this.transactionStoreNames.push(options.storeName);
			}
			this.transactionOperations.push({'type':'remove', 'key':key, 'options':options});
			return;
		}
		
		//already have transaction, for example: batch operate
		if(options.transaction){
			var transaction = options.transaction;
			var store = transaction.objectStore(options.storeName);
			
			var request = store['delete'](key);
			request.onsuccess = function (e) {
				this.log('request.onsuccess');
				result = e.target.result;
				if(result != 'undefined'){
					this.transactionObj = transaction;
					options.onSuccess(result);
					this.transactionObj = null;
				}else{
					options.onError(result);
				}
			}.bind(this);
			request.onerror = function(e){
				this.log('request.onerror');
			}.bind(this);
		}else{
			var transaction = this._remove(key, options);
		}
		
		return transaction;
	};
	
	/**
	 * Save many data in a single transaction.
	 * 
	 * @param {Array} dataArray, for example: [{one save data},{on save data}]
	 * @param {Object} options
	 * @param {String or Array} [options.storeName] Which store can be operation.
	 * @param {Function} [options.onSuccess]        A callback that is called if all operations were successful.
	 * @param {Function} [options.onError]          A callback that will be called if an error occurred during the operation.
	 * @returns {Transaction}                       The transaction used for this operation.
	 */
	HandbookIDB.prototype.saveBatch = function(dataArray, options){
		var batchData = dataArray.map(function(item){
			return { type: 'save', key: item.key || null, value: item.value || item };
		});
		return this.batch(batchData, options);
	};
	
	/**
	 * Update many data in a single transaction.
	 * 
	 * @param {Array} dataArray, for example: [{key: keyValue, value:{one update data}},{key: keyValue, value:{one update data}}]
	 * @param {Object} options
	 * @param {String or Array} [options.storeName] Which store can be operation.
	 * @param {Function} [options.onSuccess]        A callback that is called if all operations were successful.
	 * @param {Function} [options.onError]          A callback that will be called if an error occurred during the operation.
	 * @returns {Transaction}                       The transaction used for this operation.
	 */
	HandbookIDB.prototype.updateBatch = function(dataArray, options){
		var batchData = dataArray.map(function(item){
			return { type: 'update', key: item.key, value: item.value };
		});
		console.log(batchData);
		
		return this.batch(batchData, options);
	};
	
	/**
	 * Remove many data in a single transaction.
	 * 
	 * @param {Array} dataArray, for example: [{key: keyValue},{key: keyValue}] or [keyValue, keyValue]
	 * @param {Object} options
	 * @param {String or Array} [options.storeName] Which store can be operation.
	 * @param {Function} [options.onSuccess]        A callback that is called if all operations were successful.
	 * @param {Function} [options.onError]          A callback that will be called if an error occurred during the operation.
	 * @returns {Transaction}                       The transaction used for this operation.
	 */
	HandbookIDB.prototype.removeBatch = function(dataArray, options){
		var batchData = dataArray.map(function(item){
			return { type: 'remove', key: item.key || item};
		});
		return this.batch(batchData, options);
	};
	
	/**
	 * Operation many data in a single transaction, include save update and remove.
	 * 
	 * @param {Array} dataArray, for example: [{type:'add', value:{}}, {type:remove, key: 'keyvalue'}, {type:update, key:'keyvalue', value:{}}]
	 * @param {Object} options
	 * @param {String or Array} [options.storeName] Which store can be operation.
	 * @param {Function} [options.onSuccess]        A callback that is called if all operations were successful.
	 * @param {Function} [options.onError]          A callback that will be called if an error occurred during the operation.
	 * @returns {Transaction}                       The transaction used for this operation.
	 */
	HandbookIDB.prototype.batch = function(dataArray, options){
		this.log('HandbookIDB.prototype.batch');
		options = mixin({
			storeName: this.storeName,
			onSuccess: defaultSuccessHandler,
			onError: defaultErrorHandler
		}, options);

		if(Object.prototype.toString.call(dataArray) != '[object Array]'){
			options.onError('dataArray argument must be of type Array.');
			return;
		}
		var batchTransaction = this.db.transaction([options.storeName] , 'readwrite');
		batchTransaction.oncomplete = function () {
			var callback = flag ? options.onSuccess : options.onError;
			callback(flag);
		};
		batchTransaction.onabort = options.onError;
		batchTransaction.onerror = options.onError;
		var count = dataArray.length,
			called = false,
			flag = false,
			request = null;

		var onItemSuccess = function () {
			count--;
			if (count === 0 && !called) {
				called = true;
				flag = true;
			}
		};
		var store = batchTransaction.objectStore(options.storeName);
		dataArray.forEach(function (operation) {
			if(called){
				return;
			}
			var type = operation.type;
			var key = operation.key || null;
			var value = operation.value;

			var onItemError = function (e) {
				batchTransaction.abort();
				if (!called) {
					called = true;
					options.onError(e);
				}
			};
			switch(type){
				case 'save':
					request = key !== null ? store.put(value, key) : store.put(value);
					request.onsuccess = onItemSuccess;
					request.onerror = onItemError;
					break;
				case 'update':
					console.log(key);
					var getRequest = store.get(key);
					getRequest.onsuccess = function(e){
						console.log(e);
						getResult = e.target.result;
						console.log(getResult);
						if(getResult){
							for( var k in value){
								getResult[k] = typeof value[k] != 'undefined' ? value[k] : getResult[k];
							}
							request = store.put(getResult);
							request.onsuccess = onItemSuccess;
							request.onerror = onItemError;
						}else{
							onItemError('Can not get record by key');
						}
					};
					getRequest.onerror = onItemError;
					break;
				case 'remove':
					request = store['delete'](key);
					request.onsuccess = onItemSuccess;
					request.onerror = onItemError;
					break;
				default:
					break;
			}
		}, this);

		return batchTransaction;
	}
	
	/**
	 * Remove many data by index
	 * 
	 * @param {String} index                        Index name
	 * @param {*} value                             Index value
	 * @param {Object} options
	 * @param {String or Array} [options.storeName] Which store can be operation.
	 * @param {Function} [options.onSuccess]        A callback that is called if the operation was successful.
	 * @param {Function} [options.onError]          A callback that will be called if an error occurred during the operation.
	 * @returns {Transaction}                       The transaction used for this operation.
	 */
	HandbookIDB.prototype.removeByIndex = function(index, value, options){
		this.log('HandbookIDB.prototype.removeByIndex');
		options = mixin({
			storeName: this.storeName,
			onSuccess: defaultSuccessHandler,
			onError: defaultErrorHandler
		}, options);
		
		var flag = false,
			result = [];
		
		var transaction = this.db.transaction([options.storeName], 'readwrite');
		var store = transaction.objectStore(options.storeName);
		
		transaction.oncomplete = function () {
			this.log('transaction.oncomplete');
			flag ? options.onSuccess(result) : options.onError(result);
		}.bind(this);
		transaction.onabort = options.onError;
		transaction.onerror = options.onError;
		
		if(!store.indexNames.contains(index)){
			options.onError('Index:'+index+' is not exist!');
			return;
		}
		
		var store = store.index(index);
		
		var keyRange = this.makeKeyRange({only: value});
		var request = store.openCursor(keyRange);
		request.onsuccess = function(e){
			this.log('request.onsuccess');
			var cursor = e.target.result;
			if (cursor) {
				result.push(cursor.value);
				cursor['delete']();
				cursor['continue']();
			}else{
				flag = true;
			}
		}.bind(this);
		request.onerror = function(e){
			this.log('request.onerror');
		}.bind(this);
		
		return transaction;
	};
	
	/**
	 * Clear one store's data
	 * 
	 * @param {Object} options
	 * @param {String or Array} [options.storeName] Which store can be operation.
	 * @param {Function} [options.onSuccess]        A callback that is called if the operation was successful.
	 * @param {Function} [options.onError]          A callback that will be called if an error occurred during the operation.
	 * @returns {Transaction}                       The transaction used for this operation.
	 */
	HandbookIDB.prototype.clear = function(options){
		this.log('HandbookIDB.prototype.clear');
		options = mixin({
			storeName: this.storeName,
			onSuccess: defaultSuccessHandler,
			onError: defaultErrorHandler
		}, options);
		
		var flag = false,
			result = null;
		
		var transaction = this.db.transaction([options.storeName], 'readwrite');
		var store = transaction.objectStore(options.storeName);

		transaction.oncomplete = function () {
			this.log('transaction.oncomplete');
			flag ? options.onSuccess(result) : options.onError(result);
		}.bind(this);
		transaction.onabort = options.onError;
		transaction.onerror = options.onError;

		var request = store.clear();
		request.onsuccess = function(e){
			this.log('request.onsuccess');
			result = e.target.result;
			flag = true;
		}.bind(this);
		request.onerror = function(){
			this.log('request.onerror');
		}.bind(this);

		return transaction;
	};
	
	/**
	 * Make keyRange
	 * 
	 * @param {Object} options
	 * @param {String} [options.lower]
	 * @param {String} [options.upper]
	 * @param {String} [options.only]
	 * @param {Boolean} [options.excludeLower]
	 * @param {Boolean} [options.excludeUpper]
	 * @returns {keyRange}
	 */
	HandbookIDB.prototype.makeKeyRange = function(options){
		var keyRange = null,
			hasLower = typeof options.lower != 'undefined',
			hasUpper = typeof options.upper != 'undefined',
			isOnly = typeof options.only != 'undefined';
		switch(true){
		case isOnly:
			keyRange = this.keyRange.only(options.only);
			break;
		case hasLower && hasUpper:
			keyRange = this.keyRange.bound(options.lower, options.upper, options.excludeLower, options.excludeUpper);
			break;
		case hasLower:
			keyRange = this.keyRange.lowerBound(options.lower, options.excludeLower);
			break;
		case hasUpper:
			keyRange = this.keyRange.upperBound(options.upper, options.excludeUpper);
			break;
		default:
		}
		return keyRange;
	};
	
	var mixin = function (target, source) {
		var name, s;
		source = source || {};
		for (name in source) {
			s = source[name];
			if (s !== target[name]) {
				target[name] = s;
			}
		}
		return target;
	};
	Array.prototype.contains = function (element) {
		for (var i = 0; i < this.length; i++) {
			if (this[i] == element) {
				return true;
			}
		}
		return false;
	};
