//  sw version
const version = "1.2";

// static cache - App Shell
const appAssets = [
    "index.html",
    "main.js",
    "images/flame.png",
    "images/logo.png",
    "images/sync.png",
    "vendor/bootstrap.min.css",
    "vendor/jquery.min.js"
];

// sw install
self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(`static-${version}`)
        .then(cache => cache.addAll(appAssets))
    )
})

// sw activate
self.addEventListener('activate', e=>{

    //clear static cache
    let cleared = caches.keys().then(keys => {
        keys.forEach(key => {
            // cache is not current version and matches static- => previous version
            if(key !== `static-${version}` && key.match(`static-`)){
                return caches.delete(key);
            }
        })
    });

    e.waitUntil(cleared);
});

// static cache strategy - cache with network fallback
const staticCache = (req, cacheName=`static-${version}`) => {
    return caches.match(req).then(cachedRes => {
console.log('cacheName',cacheName,cachedRes );
        // return cached response if found
        if(cachedRes) return cachedRes;

        //fall back to network
        return fetch(req).then(networkRes => {
            console.log('networkRes',networkRes,cacheName );
            // update cache with new response
            caches.open(cacheName).then(cache => {
                cache.put(req,networkRes);
            })

            // return clone of network response from promise chain
            return networkRes.clone();
        })
    })
}

// network with cache fallback
const fallbackCache = (req) => {

    // try network
    return fetch(req).then(networkRes => {

        // check res is OK, else go to cache
        if(!networkRes.ok){
            throw 'Fetch Error';
        }

        // update cache
        caches.open(`static-${version}`)
        .then(cache => cache.put(req, networkRes));

        // return clone of network Response
        return networkRes.clone();
    })

    // try cache
    .catch(err => caches.match(req));
    
} 

// clean old giphy from giphy cache
const cleanGiphyCache = (giphys) =>{
    caches.open('giphy').then(cache => {

        // get all cache enteries
        cache.keys().then(keys => {
            // loop enteries (requests)
            keys.forEach(key =>{

                // if entry is not part of current giphys, Delete
                if(!giphys.includes(key.url)){
                    cache.delete(key);
                }

            })
        })
    })
}


// sw fetch
self.addEventListener('fetch', e=>{
    console.log('e.request.url', e.request.url);
    // app shell
    if(e.request.url.match(location.origin)){
        e.respondWith(staticCache(e.request));
        
        // gify API
    } else if(e.request.url.match('https://api.giphy.com/v1/gifs/trending')){
        e.respondWith(fallbackCache(e.request));

        // gify media - cache GIFS
    }else if(e.request.url.match('giphy.com/media')){
        // when we update sw we loose all our gifs 
        // having them in different cache means they will never get cleaned up as we only clean static cache when sw updates
        e.respondWith(staticCache(e.request, 'giphy'));
    }

});

// listen for msg from client
self.addEventListener('message', e=>{

    // identify msg
    if(e.data.action ==='cleanGiphyCache'){
        cleanGiphyCache(e.data.giphys);
    }
})