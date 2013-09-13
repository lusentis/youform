YouForm
=======
YouForm is a tool for your static websites for sending forms to an e-mail address.
## Environment Variables ##
Add the following to your .env file.
```bash
# COUCHDB URL
export DATABASE_URL= ...

# POSTMARK settings
export POSTMARK_API_KEY= ...
export POSTMARK_FROM= ...

# AKISMET API KEY
export AKISMET_API_KEY= ...

# HQ SMS settings
export HQ_USERNAME= ...
export HQ_PASSWORD= ...
export HQ_SENDER= ...

export SITE_SECRET= ...
```
## License ##

Copyright (c) 2013 PlasticPanda.com

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the “Software”), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
