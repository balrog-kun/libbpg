/*
 * BPG Javascript decoder
 *
 * Copyright (c) 2014 Fabrice Bellard
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
 * THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */
window['BPGDecoder'] = function(ctx) {
    this.ctx = ctx;
    this['imageData'] = null;
    this['onload'] = null;
    this['frames'] = null;
    this['loop_count'] = 0;
}

window['BPGDecoder'].prototype = {

malloc: Module['cwrap']('malloc', 'number', [ 'number' ]),

free: Module['cwrap']('free', 'void', [ 'number' ]),

bpg_decoder_open: Module['cwrap']('bpg_decoder_open', 'number', [ ]),

bpg_decoder_decode: Module['cwrap']('bpg_decoder_decode', 'number', [ 'number', 'array', 'number' ]),

bpg_decoder_get_info: Module['cwrap']('bpg_decoder_get_info', 'number', [ 'number', 'number' ]),

bpg_decoder_start: Module['cwrap']('bpg_decoder_start', 'number', [ 'number', 'number' ]),

bpg_decoder_get_frame_duration: Module['cwrap']('bpg_decoder_get_frame_duration', 'void', [ 'number', 'number', 'number' ]),

bpg_decoder_get_line: Module['cwrap']('bpg_decoder_get_line', 'number', [ 'number', 'number' ]),

bpg_decoder_close: Module['cwrap']('bpg_decoder_close', 'void', [ 'number' ] ),

load: function(url) 
{
    var request = new XMLHttpRequest();
    var this1 = this;

    request.open("get", url, true);
    request.responseType = "arraybuffer";
    request.onload = function(event) {
        this1._onload(request, event);
    };
    request.send();
},

_onload: function(request, event)
{
    var data = request.response;
    var array = new Uint8Array(data);
    var img, w, h, img_info_buf, cimg, p0, rgba_line, w4, frame_count;
    var heap8, heap16, heap32, dst, v, i, y, func, duration, frames, loop_count;

    //    console.log("loaded " + data.byteLength + " bytes");

    img = this.bpg_decoder_open();

    if (this.bpg_decoder_decode(img, array, array.length) < 0) {
        console.log("could not decode image");
        return;
    }
    
    img_info_buf = this.malloc(5 * 4);
    this.bpg_decoder_get_info(img, img_info_buf);
    /* extract the image info */
    heap8 = Module['HEAPU8'];
    heap16 = Module['HEAPU16'];
    heap32 = Module['HEAPU32'];
    w = heap32[img_info_buf >> 2];
    h = heap32[(img_info_buf + 4) >> 2];
    loop_count = heap16[(img_info_buf + 16) >> 1];
    //    console.log("image: w=" + w + " h=" + h + " loop_count=" + loop_count);
    
    w4 = w * 4;
    rgba_line = this.malloc(w4);

    frame_count = 0;
    frames = [];
    for(;;) {
        /* select RGBA32 output */
        if (this.bpg_decoder_start(img, 1) < 0)
            break;
        this.bpg_decoder_get_frame_duration(img, img_info_buf, 
                                            img_info_buf + 4);
        duration = (heap32[img_info_buf >> 2] * 1000) / heap32[(img_info_buf + 4) >> 2];

        cimg = this.ctx.createImageData(w, h);
        dst = cimg.data;
        p0 = 0;
        for(y = 0; y < h; y++) {
            this.bpg_decoder_get_line(img, rgba_line);
            for(i = 0; i < w4; i = (i + 1) | 0) {
                dst[p0] = heap8[(rgba_line + i) | 0] | 0;
                p0 = (p0 + 1) | 0;
            }
        }
        frames[frame_count++] = { 'img': cimg, 'duration': duration };
    }

    this.free(rgba_line);
    this.free(img_info_buf);

    this.bpg_decoder_close(img);

    this['loop_count'] = loop_count;
    this['frames'] = frames;
    this['imageData'] = frames[0]['img'];

    if (this['onload'])
        this['onload']();
}

};
