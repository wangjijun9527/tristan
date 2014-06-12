chrome.app.runtime.onLaunched.addListener(function() {
	chrome.app.window.create('index.html', {id: 'main_window', width: 500, height: 500});
});