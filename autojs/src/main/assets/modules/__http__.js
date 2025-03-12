module.exports = function (runtime, scope) {
    importPackage(Packages["okhttp3"]);
    importClass(com.stardust.autojs.core.http.MutableOkHttp);
    var http = {};
    http.__okhttp__ = new MutableOkHttp();

    http.get = function (url, options, callback) {
        options = options || {};
        options.method = "GET";
        return http.request(url, options, callback);
    }

    http.client = function () {
        return http.__okhttp__.client();
    }

    http.post = function (url, data, options, callback) {
        options = options || {};
        options.method = "POST";
        options.contentType = options.contentType || "application/x-www-form-urlencoded";
        if (data) {
            fillPostData(options, data);
        }
        return http.request(url, options, callback);
    }

    http.postJson = function (url, data, options, callback) {
        options = options || {};
        options.contentType = "application/json";
        return http.post(url, data, options, callback);
    }

    http.postMultipart = function (url, files, options, callback) {
        options = options || {};
        options.method = "POST";
        options.contentType = "multipart/form-data";
        options.files = files;
        return http.request(url, options, callback);
    }

    http.request = function (url, options, callback) {
        // Added by ozobi - 2025/01/31 > 设置 http 最大尝试次数、超时时间
        if(options.maxTry){
            http.__okhttp__.setMaxRetries(options.maxTry);
        }
        if(options.timeout){
            http.__okhttp__.setTimeout(Math.floor(options.timeout));
        }
        // 添加: 设置代理
        if(options.proxyHost && options.proxyPort){
            http.__okhttp__.setProxy(options.proxyHost, options.proxyPort);
        }
        // <
        var cont = null;

        if (!callback && ui.isUiThread() && continuation.enabled) {
            cont = continuation.create();
        }
        var call = http.client().build().newCall(http.buildRequest(url, options));// Modified by ozobi > 添加: 设置代理
        let result;
        let packageName = context.getPackageName().toString();
        let timeoutErr;
        if (!callback && !cont) {
            if(packageName.indexOf("ozobi") != -1 && packageName.indexOf("autoxjs") != -1){
                let thread = threads.start(()=>{
                    try{
                        result = wrapResponse(call.execute());
                    }catch(e){
                        timeoutErr = e;
                    }
                })
                while(thread.isAlive() && result === undefined && !runtime.getmThread().isInterrupted()){
                   sleep(10);
                }
                if(runtime.getmThread().isInterrupted()){
                   throw "停止脚本";
                }
                if(timeoutErr != undefined){
                    throw timeoutErr;
                }
                return result;
            }else{
                return wrapResponse(call.execute());
            }
        }
        call.enqueue(new Callback({
            onResponse: function (call, res) {
                res = wrapResponse(res);
                cont && cont.resume(res);
                callback && callback(res);
            },
            onFailure: function (call, ex) {
                cont && cont.resumeError(ex);
                callback && callback(null, ex);
            }
        }));
        if (cont) {
            if(packageName.indexOf("ozobi") != -1 && packageName.indexOf("autoxjs") != -1){
                let thread = threads.start(()=>{
                   try{
                       result = cont.await();
                   }catch(e){
                       timeoutErr = e;
                   }
                })
                while(thread.isAlive() && result === undefined && !runtime.getmThread().isInterrupted()){
                   sleep(10);
                }
                if(runtime.getmThread().isInterrupted()){
                   throw "停止脚本";
                }
                if(timeoutErr != undefined){
                    throw timeoutErr;
                }
                return result;
            }else{
                return cont.await();
            }
        }
    }

    http.buildRequest = function (url, options) {
        var r = new Request.Builder();
        if (!url.startsWith("http://") && !url.startsWith("https://")) {
            url = "http://" + url;
        }
        r.url(url);
        if (options.headers) {
            setHeaders(r, options.headers);
        }
        // Added by ozobi - 2025/02/01 > 添加设置代理身份认证
        if(options.userName && options.password){
            let credential = Credentials.basic(options.userName, options.password)
            r.header("Proxy-Authorization", credential)
        }
        // <
        if (options.body) {
            r.method(options.method, parseBody(options, options.body));
        } else if (options.files) {
            r.method(options.method, parseMultipart(options.files));
        } else {
            r.method(options.method, null);
        }
        return r.build();
    }

    function parseMultipart(files) {
        var builder = new MultipartBody.Builder()
            .setType(MultipartBody.FORM);
        for (var key in files) {
            if (!files.hasOwnProperty(key)) {
                continue;
            }
            var value = files[key];
            if (typeof (value) == 'string') {
                builder.addFormDataPart(key, value);
                continue;
            }
            var path, mimeType, fileName;
            if (typeof (value.getPath) == 'function') {
                path = value.getPath();
            } else if (value.length == 2) {
                fileName = value[0];
                path = value[1];
            } else if (value.length >= 3) {
                fileName = value[0];
                mimeType = value[1]
                path = value[2];
            }
            var file = new com.stardust.pio.PFile(path);
            fileName = fileName || file.getName();
            mimeType = mimeType || parseMimeType(file.getExtension());
            builder.addFormDataPart(key, fileName, RequestBody.create(MediaType.parse(mimeType), file));
        }
        return builder.build();
    }

    function parseMimeType(ext) {
        if (ext.length == 0) {
            return "application/octet-stream";
        }
        return android.webkit.MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext)
            || "application/octet-stream";
    }

    function fillPostData(options, data) {
        if (options.contentType == "application/x-www-form-urlencoded") {
            var b = new FormBody.Builder();
            for (var key in data) {
                if (data.hasOwnProperty(key)) {
                    b.add(key, data[key]);
                }
            }
            options.body = b.build();
        } else if (options.contentType == "application/json") {
            options.body = JSON.stringify(data);
        } else {
            options.body = data;
        }
    }

    function setHeaders(r, headers) {
        for (var key in headers) {
            if (headers.hasOwnProperty(key)) {
                let value = headers[key];
                if (Array.isArray(value)) {
                    value.forEach(v => {
                        r.header(key, v);
                    });
                } else {
                    r.header(key, value);
                }
            }
        }
    }

    function parseBody(options, body) {
        if (typeof (body) == "string") {
            body = RequestBody.create(MediaType.parse(options.contentType), body);
        } else if (body instanceof RequestBody) {
            return body;
        } else {
            body = new RequestBody({
                contentType: function () {
                    return MediaType.parse(options.contentType);
                },
                writeTo: body
            });
        }
        return body;
    }

    function wrapResponse(res) {
        var r = {};
        r.statusCode = res.code();
        r.statusMessage = res.message();
        var headers = res.headers();
        r.headers = {};
        for (var i = 0; i < headers.size(); i++) {
            let name = headers.name(i);
            let value = headers.value(i);
            if (r.headers.hasOwnProperty(name)) {
                let origin = r.headers[name];
                if (!Array.isArray(origin)) {
                    r.headers[name] = [origin];
                }
                r.headers[name].push(value);
            } else {
                r.headers[name] = value;
            }
        }
        r.body = {};
        var body = res.body();
        r.body.string = body.string.bind(body);
        r.body.bytes = body.bytes.bind(body);
        r.body.json = function () {
            return JSON.parse(r.body.string());
        }
        r.body.contentType = body.contentType();
        r.request = res.request();
        r.url = r.request.url();
        r.method = r.request.method();
        return r;
    }

    return http;
}