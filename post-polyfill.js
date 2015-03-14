/* Polyfill version that replaces the img, not very reliable */
window.bgpload = function(el) {
    /* change the tag to canvas */
    var url = el.src;
    var canvas = document.createElement("canvas");

    if (el.id)
        canvas.id = el.id;
    if (el.className)
        canvas.className = el.className;
    if (el.onload)
        canvas.onimgload = el.onload;
    if (el.onerror)
        canvas.onimgerror = el.onerror;

    var style = el.getAttribute("style") | 0;
    if (style)
        canvas.style = style;

    /* handle simple attribute cases to resize the canvas */
    var dw = el.getAttribute("width") | 0;
    if (dw)
        canvas.style.width = dw + "px";
    var dh = el.getAttribute("height") | 0;
    if (dh)
        canvas.style.height = dh + "px";

    el.parentNode.replaceChild(canvas, el);

    var ctx = canvas.getContext("2d");
    var dec = new BPGDecoder(ctx);
    dec.onload = (function(canvas, ctx) {
        var dec = this;
        var frames = this['frames'];
        var imageData = frames[0]['img'];
        function next_frame() {
            var frame_index = dec.frame_index;

            /* compute next frame index */
            if (++frame_index >= frames.length) {
                if (dec['loop_count'] == 0 ||
                        dec.loop_counter < dec['loop_count']) {
                    frame_index = 0;
                    dec.loop_counter++;
                } else {
                    frame_index = -1;
                }
            }
            if (frame_index >= 0) {
                dec.frame_index = frame_index;
                ctx.putImageData(frames[frame_index]['img'], 0, 0);
                setTimeout(next_frame, frames[frame_index]['duration']);
            }
        };

        /* resize the canvas to the image size */
        canvas.width = imageData.width;
        canvas.height = imageData.height;

        /* draw the image */
        ctx.putImageData(imageData, 0, 0);

        /* if it is an animation, add a timer to display the next frame */
        if (frames.length > 1) {
            dec.frame_index = 0;
            dec.loop_counter = 0;
            setTimeout(next_frame, frames[0]['duration']);
        }

        /* If the image had an onload handler, call it */
        if ('onimgload' in canvas)
            canvas.onimgload();
    }).bind(dec, canvas, ctx);
    dec.load(url);
};

/* Version that replaces the img's src with the data:// url for the image */
window.bgpload = function(el, src) {
    var canvas = document.createElement("canvas");
    canvas.orig = el;

    /* Make sure onload and onerror aren't called for the orig url */
    if (el.onload) {
        el.onimgload = el.onload;
        el.onload = undefined;
    }
    if (el.onerror) {
        el.onimgerror = el.onerror;
        el.onerror = undefined;
    }

    var ctx = canvas.getContext("2d");
    var dec = new BPGDecoder(ctx);
    dec.onload = (function(canvas, ctx) {
        var dec = this;
        var frames = this['frames'];
        var imageData = frames[0]['img'];
        function next_frame() {
            var frame_index = dec.frame_index;

            /* compute next frame index */
            if (++frame_index >= frames.length) {
                if (dec['loop_count'] == 0 ||
                        dec.loop_counter < dec['loop_count']) {
                    frame_index = 0;
                    dec.loop_counter++;
                } else {
                    frame_index = -1;
                }
            }
            if (frame_index >= 0) {
                dec.frame_index = frame_index;
                ctx.putImageData(frames[frame_index]['img'], 0, 0);
                canvas.orig.src = canvas.toDataURL("image/png");
                setTimeout(next_frame, frames[frame_index]['duration']);
            }
        };

        /* resize the canvas to the image size */
        canvas.width = imageData.width;
        canvas.height = imageData.height;

        /* draw the image */
        ctx.putImageData(imageData, 0, 0);
        canvas.orig.src = canvas.toDataURL("image/png");

        if ('onimgload' in canvas.orig)
            canvas.orig.onimgload({})

        /* if it is an animation, add a timer to display the next frame */
        if (frames.length > 1) {
            dec.frame_index = 0;
            dec.loop_counter = 0;
            setTimeout(next_frame, frames[0]['duration']);
        }
    }).bind(dec, canvas, ctx);
    dec.onerror = (function(canvas, ctx) {
        if ('onimgerror' in canvas.orig)
            canvas.orig.onimgerror({})
    }).bind(dec, canvas, ctx);
    dec.load(src);
};

var check_src = function(el, src) {
    /* We should only rely on the MIME type here but that's difficult with
     * a format that isn't well supported.
     */
    if (el.last_src == src || src.substr(-4, 4).toLowerCase() != ".bpg")
        return;

    /* TODO: cancel previous load if any */
    window.bgpload(el, src);
    el.last_src = src;
}

var check_node = function(el) {
    if (el.tagName !== 'img')
        return;

    check_src(el, el.src);

    var MutationObserver = window.MutationObserver ||
        window.WebKitMutationObserver;
    var eventListenerSupported = window.addEventListener;

    if (MutationObserver) {
        /* Define a new observer */
        var obs = new MutationObserver(function(mutations, observer) {
            check_src(mutations[0].target, mutations[0].target.src);
        });
        /* Have the observer observe the DOM src attribute */
        obs.observe(el, { attributes: true, attributeFilter: [ 'src' ] });
    } else if (eventListenerSupported) {
        el.addEventListener('DOMAttrModified',
                function(e) { check_src(e.target, e.target.src); }, false);
    }
}

window.addEventListener("load", function() {
    for (var i = 0; i < document.images.length; i++)
        check_node(document.images[i]);

    var MutationObserver = window.MutationObserver ||
        window.WebKitMutationObserver;
    var eventListenerSupported = window.addEventListener;

    if (MutationObserver) {
        /* Define a new observer */
        var obs = new MutationObserver(function(mutations, observer) {
            for (var i = 0; i < mutations.length; i++)
                for (var j = 0; j < mutations[i].addedNodes.length; j++)
                    check_node(mutations[i].addedNodes[j]);
        });
        /* Have the observer observe additions across the document */
        obs.observe(document.body, { childList: true, subtree: true });
    } else if (eventListenerSupported) {
        document.body.addEventListener('DOMNodeInserted',
                function(e) { check_node(e.target); }, false);
    }
});
