YouForm
=======

YouForm is a tool for your static websites for sending forms to an e-mail address.

## Environment Variables

``` Base settings
export SITE_SECRET= ...
export DATABASE_URL= ...
```

[Postmark](https://github.com/voodootikigod/postmark.js)
```
export POSTMARK_API_KEY= ...
export POSTMARK_FROM= ...

[Akismet](https://github.com/chrisfosterelli/akismet-api)
```
export AKISMET_API_KEY= ...
```

[HQ SMS][http://www.hqsms.com/]
```
export HQ_USERNAME= ...
export HQ_PASSWORD= ...
export HQ_SENDER= ...
```

## License ##

Copyright (c) 2013 PlasticPanda.com

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the “Software”), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.