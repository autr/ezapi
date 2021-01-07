RASPIVID

```
"raspivid" Camera App (commit 9f3f9054a692 Tainted)

Display camera output to display, and optionally saves an H264 capture at requested bitrate


usage: raspivid [options]

Image parameter commands

-b, --bitrate : Set bitrate. Use bits per second (e.g. 10MBits/s would be -b 10000000)
-t, --timeout : Time (in ms) to capture for. If not specified, set to 5s. Zero to disable
-d, --demo  : Run a demo mode (cycle through range of camera options, no capture)
-fps, --framerate : Specify the frames per second to record
-e, --penc  : Display preview image *after* encoding (shows compression artifacts)
-g, --intra : Specify the intra refresh period (key frame rate/GoP size). Zero to produce an initial I-frame and then just P-frames.
-pf, --profile  : Specify H264 profile to use for encoding
-td, --timed  : Cycle between capture and pause. -cycle on,off where on is record time and off is pause time in ms
-s, --signal  : Cycle between capture and pause on Signal
-k, --keypress  : Cycle between capture and pause on ENTER
-i, --initial : Initial state. Use 'record' or 'pause'. Default 'record'
-qp, --qp : Quantisation parameter. Use approximately 10-40. Default 0 (off)
-ih, --inline : Insert inline headers (SPS, PPS) to stream
-sg, --segment  : Segment output file in to multiple files at specified interval <ms>
-wr, --wrap : In segment mode, wrap any numbered filename back to 1 when reach number
-sn, --start  : In segment mode, start with specified segment number
-sp, --split  : In wait mode, create new output file for each start event
-c, --circular  : Run encoded data through circular buffer until triggered then save
-x, --vectors : Output filename <filename> for inline motion vectors
-if, --irefresh : Set intra refresh type
-fl, --flush  : Flush buffers in order to decrease latency
-pts, --save-pts  : Save Timestamps to file for mkvmerge
-cd, --codec  : Specify the codec to use - H264 (default) or MJPEG
-lev, --level : Specify H264 level to use for encoding
-r, --raw : Output filename <filename> for raw video
-rf, --raw-format : Specify output format for raw video. Default is yuv
-l, --listen  : Listen on a TCP socket
-stm, --spstimings  : Add in h.264 sps timings
-sl, --slices : Horizontal slices per frame. Default 1 (off)


H264 Profile options :
baseline,main,high

H264 Level options :
4,4.1,4.2

H264 Intra refresh options :
cyclic,adaptive,both,cyclicrows

Raw output format options :
yuv,rgb,gray

Raspivid allows output to a remote IPv4 host e.g. -o tcp://192.168.1.2:1234or -o udp://192.168.1.2:1234
To listen on a TCP port (IPv4) and wait for an incoming connection use the -l option
e.g. raspivid -l -o tcp://0.0.0.0:3333 -> bind to all network interfaces,
raspivid -l -o tcp://192.168.1.1:3333 -> bind to a certain local IPv4 port

Common Settings commands

-?, --help  : This help information
-w, --width : Set image width <size>
-h, --height  : Set image height <size>
-o, --output  : Output filename <filename> (to write to stdout, use '-o -'). If not specified, no file is saved
-v, --verbose : Output verbose information during run
-cs, --camselect  : Select camera <number>. Default 0
-md, --mode : Force sensor mode. 0=auto. See docs for other modes available
-gps, --gpsdexif  : Apply real-time GPS information to output (e.g. EXIF in JPG, annotation in video (requires libgps.so.23)

Preview parameter commands

-p, --preview : Preview window settings <'x,y,w,h'>
-f, --fullscreen  : Fullscreen preview mode
-op, --opacity  : Preview window opacity (0-255)
-n, --nopreview : Do not display a preview window
-dn, --dispnum  : Display on which to display the preview window (dispmanx/tvservice numbering)

Image parameter commands

-sh, --sharpness  : Set image sharpness (-100 to 100)
-co, --contrast : Set image contrast (-100 to 100)
-br, --brightness : Set image brightness (0 to 100)
-sa, --saturation : Set image saturation (-100 to 100)
-ISO, --ISO : Set capture ISO
-vs, --vstab  : Turn on video stabilisation
-ev, --ev : Set EV compensation - steps of 1/6 stop
-ex, --exposure : Set exposure mode (see Notes)
-fli, --flicker : Set flicker avoid mode (see Notes)
-awb, --awb : Set AWB mode (see Notes)
-ifx, --imxfx : Set image effect (see Notes)
-cfx, --colfx : Set colour effect (U:V)
-mm, --metering : Set metering mode (see Notes)
-rot, --rotation  : Set image rotation (0, 90, 180, or 270)
-hf, --hflip  : Set horizontal flip
-vf, --vflip  : Set vertical flip
-roi, --roi : Set region of interest (x,y,w,d as normalised coordinates [0.0-1.0])
-ss, --shutter  : Set shutter speed in microseconds
-awbg, --awbgains : Set AWB gains - AWB mode must be off
-drc, --drc : Set DRC Level (see Notes)
-st, --stats  : Force recomputation of statistics on stills capture pass
-a, --annotate  : Enable/Set annotate flags or text
-3d, --stereo : Select stereoscopic mode
-dec, --decimate  : Half width/height of stereo image
-3dswap, --3dswap : Swap camera order for stereoscopic
-ae, --annotateex : Set extra annotation parameters (text size, text colour(hex YUV), bg colour(hex YUV), justify, x, y)
-ag, --analoggain : Set the analog gain (floating point)
-dg, --digitalgain  : Set the digital gain (floating point)
-set, --settings  : Retrieve camera settings and write to stdout
-fw, --focus  : Draw a window with the focus FoM value on the image.


Notes

Exposure mode options :
off,auto,night,nightpreview,backlight,spotlight,sports,snow,beach,verylong,fixedfps,antishake,fireworks

Flicker avoid mode options :
off,auto,50hz,60hz

AWB mode options :
off,auto,sun,cloud,shade,tungsten,fluorescent,incandescent,flash,horizon,greyworld

Image Effect mode options :
none,negative,solarise,sketch,denoise,emboss,oilpaint,hatch,gpen,pastel,watercolour,film,blur,saturation,colourswap,washedout,posterise,colourpoint,colourbalance,cartoon

Metering Mode options :
average,spot,backlit,matrix

Dynamic Range Compression (DRC) options :
off,low,med,high

  ```

V4L2-CTL

```
Driver Info:
  Driver name      : bm2835 mmal
  Card type        : mmal service 16.1
  Bus info         : platform:bcm2835-v4l2-0
  Driver version   : 5.10.4
  Capabilities     : 0x85200005
    Video Capture
    Video Overlay
    Read/Write
    Streaming
    Extended Pix Format
    Device Capabilities
  Device Caps      : 0x05200005
    Video Capture
    Video Overlay
    Read/Write
    Streaming
    Extended Pix Format
Priority: 2
Video input : 0 (Camera 0: ok)
Format Video Capture:
  Width/Height      : 640/480
  Pixel Format      : 'YU12' (Planar YUV 4:2:0)
  Field             : None
  Bytes per Line    : 640
  Size Image        : 460800
  Colorspace        : SMPTE 170M
  Transfer Function : Default (maps to Rec. 709)
  YCbCr/HSV Encoding: Default (maps to ITU-R 601)
  Quantization      : Default (maps to Limited Range)
  Flags             :
Format Video Overlay:
  Left/Top    : 150/50
  Width/Height: 1024/768
  Field       : None
  Chroma Key  : 0x00000000
  Global Alpha: 0xff
  Clip Count  : 0
  Clip Bitmap : No
Framebuffer Format:
  Capability    : Extern Overlay
      Global Alpha
  Flags         : Overlay Matches Capture/Output Size
  Width         : 640
  Height        : 480
  Pixel Format  : 'YU12'
Streaming Parameters Video Capture:
  Capabilities     : timeperframe
  Frames per second: 30.000 (300000/10000)
  Read buffers     : 1

User Controls

                     brightness 0x00980900 (int)    : min=0 max=100 step=1 default=50 value=50 flags=slider
                       contrast 0x00980901 (int)    : min=-100 max=100 step=1 default=0 value=0 flags=slider
                     saturation 0x00980902 (int)    : min=-100 max=100 step=1 default=0 value=0 flags=slider
                    red_balance 0x0098090e (int)    : min=1 max=7999 step=1 default=1000 value=1000 flags=slider
                   blue_balance 0x0098090f (int)    : min=1 max=7999 step=1 default=1000 value=1000 flags=slider
                horizontal_flip 0x00980914 (bool)   : default=0 value=0
                  vertical_flip 0x00980915 (bool)   : default=0 value=0
           power_line_frequency 0x00980918 (menu)   : min=0 max=3 default=1 value=1
                      sharpness 0x0098091b (int)    : min=-100 max=100 step=1 default=0 value=0 flags=slider
                  color_effects 0x0098091f (menu)   : min=0 max=15 default=0 value=0
                         rotate 0x00980922 (int)    : min=0 max=360 step=90 default=0 value=0 flags=modify-layout
             color_effects_cbcr 0x0098092a (int)    : min=0 max=65535 step=1 default=32896 value=32896

Codec Controls

             video_bitrate_mode 0x009909ce (menu)   : min=0 max=1 default=0 value=0 flags=update
                  video_bitrate 0x009909cf (int)    : min=25000 max=25000000 step=25000 default=10000000 value=10000000
         repeat_sequence_header 0x009909e2 (bool)   : default=0 value=0
            h264_i_frame_period 0x00990a66 (int)    : min=0 max=2147483647 step=1 default=60 value=60
                     h264_level 0x00990a67 (menu)   : min=0 max=11 default=11 value=11
                   h264_profile 0x00990a6b (menu)   : min=0 max=4 default=4 value=4

Camera Controls

                  auto_exposure 0x009a0901 (menu)   : min=0 max=3 default=0 value=0
         exposure_time_absolute 0x009a0902 (int)    : min=1 max=10000 step=1 default=1000 value=1000
     exposure_dynamic_framerate 0x009a0903 (bool)   : default=0 value=0
             auto_exposure_bias 0x009a0913 (intmenu): min=0 max=24 default=12 value=12
      white_balance_auto_preset 0x009a0914 (menu)   : min=0 max=9 default=1 value=1
            image_stabilization 0x009a0916 (bool)   : default=0 value=0
                iso_sensitivity 0x009a0917 (intmenu): min=0 max=4 default=0 value=0
           iso_sensitivity_auto 0x009a0918 (menu)   : min=0 max=1 default=1 value=1
         exposure_metering_mode 0x009a0919 (menu)   : min=0 max=3 default=0 value=0
                     scene_mode 0x009a091a (menu)   : min=0 max=13 default=0 value=0

JPEG Compression Controls

            compression_quality 0x009d0903 (int)    : min=1 max=100 step=1 default=30 value=30

```