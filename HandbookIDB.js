	
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
			debug: false
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
	
	HandbookIDB.prototype.onupgradeneeded = function(e){
		this.log('HandbookIDB.prototype.onupgradeneeded');
		this.db = e.target.result;
		switch(this.version){
		case 1:
			this.db.objectStoreNames
			var store = db.createObjectStore("books", {keyPath:"id", autoIncrement: true});
			store.createIndex('userid','userid',{unique:false});
			store.createIndex('category','category',{unique:false}); 
			break;
		case 53:
			console.log('--53--');
		default:
			console.log('--default--');
			break;
		}
	};
	
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
		transaction.onabort = options.onError;
		transaction.onerror = options.onError;
		
		var request = store.get(key);
		request.onsuccess = function(e){
			this.log('request.onsuccess');
			result = e.target.result;
			flag = true;
		}.bind(this);
		request.onerror = function(e){
			this.log('request.onerror');
			options.onError(e);
		}.bind(this);
		
		return transaction;
	};
	
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
			options.onError(e);
		}.bind(this);
		
		return transaction;
	};

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
		request.onerror = options.onError;
		return transaction;
	};
	
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
		request.onsuccess = function (e) {
			this.log('request.onsuccess');
			result = e.target.result;
			flag = true;
		}.bind(this);
		request.onError = options.onError;

		return transaction;
	};
	
	HandbookIDB.prototype._save = function(data, options){
		this.log('HandbookIDB.prototype._save');
		
		var flag = false,
		request = null,
		result = null;
	
		var transaction = this.db.transaction([options.storeName], 'readwrite');
		transaction.oncomplete = function () {
			this.log('transaction.oncomplete');
			if(flag){
				options.onSuccess(result);
			}
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
	
	HandbookIDB.prototype.saveBatch = function(dataArray, options){
		this.log('HandbookIDB.prototype.saveBatch');
		options = mixin({
			storeName: this.storeName,
			onSuccess: defaultSuccessHandler,
			onError: defaultErrorHandler
		}, options);
		
		if(Object.prototype.toString.call(dataArray) != '[object Array]'){
			options.onError(new Error('dataArray argument must be of type Array.'));
			return;
		}
		
		var flag = false,
			called = false,
			result = null,
			count = dataArray.length;

		var batchTransaction = this.db.transaction([options.storeName] , 'readwrite');
		batchTransaction.oncomplete = function () {
			this.log('batchTransaction.oncomplete');
			flag ? options.onSuccess(flag) : options.onError(flag);
		}.bind(this);
		batchTransaction.onabort = options.onError;
		batchTransaction.onerror = options.onError;

		var onItemSuccess = function () {
			count--;
			if (count === 0 && !called) {
				called = true;
				flag = true;
			}
		};

		dataArray.forEach(function (data) {
			var key = typeof data.key != 'undefined' ? data.key : null;
			var value = key == null && data.value ? data.value : data;
			var onItemError = function (e) {
				batchTransaction.abort();
				if (!called) {
					called = true;
					options.onError(e);
				}
			};

			var putRequest;
			if (key) { //out-of-line keys
				putRequest = batchTransaction.objectStore(options.storeName).put(value, key);
			} else { //in-line keys
				putRequest = batchTransaction.objectStore(options.storeName).put(value);
			}
			putRequest.onsuccess = onItemSuccess;
			putRequest.onerror = onItemError;
		}, this);
		
		return batchTransaction;
	};
	
	HandbookIDB.prototype.updateBatch = function(data, options){
		
	};
	
	/*
	 * dataArray: [{type:'add', key:'keyvalue', value:{}}, {type:remove, key: 'keyvalue', value{}}, {type:update, key:'keyvalue', value:{}}]
	 */
	HandbookIDB.prototype.batch = function(dataArray, options){
		this.log('HandbookIDB.prototype.saveBatch');
		options = mixin({
			storeName: this.storeName,
			onSuccess: defaultSuccessHandler,
			onError: defaultErrorHandler
		}, options);

		if(Object.prototype.toString.call(dataArray) != '[object Array]'){
			options.onError(new Error('dataArray argument must be of type Array.'));
			return;
		}
		var batchTransaction = this.db.transaction([this.storeName] , 'readwrite');
		batchTransaction.oncomplete = function () {
			var callback = hasSuccess ? onSuccess : onError;
			callback(hasSuccess);
		};
		batchTransaction.onabort = options.onError;
		batchTransaction.onerror = options.onError;

		var count = dataArray.length;
		var called = false;
		var flag = false;

		var onItemSuccess = function () {
			count--;
			if (count === 0 && !called) {
				called = true;
				flag = true;
			}
		};

		dataArray.forEach(function (operation) {
			var type = operation.type;
			var key = operation.key;
			var value = operation.value;

			var onItemError = function (e) {
				batchTransaction.abort();
				if (!called) {
					called = true;
					onError(e, type, key);
				}
			};

			if (type == 'remove') {
				var deleteRequest = batchTransaction.objectStore(this.storeName)['delete'](key);
				deleteRequest.onsuccess = onItemSuccess;
				deleteRequest.onerror = onItemError;
			} else if (type == 'put') {
				var putRequest;
				if (key !== null) { // out-of-line keys
					putRequest = batchTransaction.objectStore(this.storeName).put(value, key);
				} else { // in-line keys
					putRequest = batchTransaction.objectStore(this.storeName).put(value);
				}
				putRequest.onsuccess = onItemSuccess;
				putRequest.onerror = onItemError;
			}
		}, this);

		return batchTransaction;
	}
	
	HandbookIDB.prototype.removeBatch = function(dataArray, options){
		this.log('HandbookIDB.prototype.removeBatch');
		options = mixin({
			storeName: this.storeName,
			onSuccess: defaultSuccessHandler,
			onError: defaultErrorHandler
		}, options);
		
		if(Object.prototype.toString.call(dataArray) != '[object Array]'){
			options.onError(new Error('dataArray argument must be of type Array.'));
			return;
		}
		
		var flag = false,
			called = false,
			result = null,
			count = dataArray.length;

		var batchTransaction = this.db.transaction([options.storeName] , 'readwrite');
		batchTransaction.oncomplete = function () {
			this.log('batchTransaction.oncomplete');
			flag ? options.onSuccess(flag) : options.onError(flag);
		}.bind(this);
		batchTransaction.onabort = options.onError;
		batchTransaction.onerror = options.onError;

		var onItemSuccess = function () {
			count--;
			if (count === 0 && !called) {
				called = true;
				flag = true;
			}
		};
		var batchStore = batchTransaction.objectStore(this.storeName);
		dataArray.forEach(function (key) {
			var onItemError = function (e) {
				batchTransaction.abort();
				if (!called) {
					called = true;
					options.onError(e);
				}
			};
			var deleteRequest = batchStore['delete'](key);
			deleteRequest.onsuccess = onItemSuccess;
			deleteRequest.onerror = onItemError;
		}, this);
		
		return batchTransaction;
	};
	
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
			transaction.abort();
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
	};
	
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
	
	HandbookIDB.prototype.makeKeyRange = function(options){
		console.log(options);
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