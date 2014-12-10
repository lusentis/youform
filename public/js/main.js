'use strict';

(function () {
  NodeList.prototype.forEach = Array.prototype.forEach; 
  HTMLCollection.prototype.forEach = Array.prototype.forEach;
})();


var YouformApp = {};

YouformApp.loadDashoboard = function (form_id, form_token) {

  // Load months

  var months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  Array.prototype.forEach.call(document.querySelectorAll('.month-name'), function (el) {      
    var monthNumber = parseInt(el.innerHTML, 10);
    el.innerHTML = months[monthNumber - 1] + ': ';
  });

  var _loadData = function _loadData(graph) {
    var ok = [],
      spam = [],
      labels = [],
      maxValue = 0;
    
    Object.keys(graph).forEach(function (key) {
      var item = graph[key];
      // graph labels
      labels.push(months[item[1] -1]);
      // spam
      spam.push(item[3]);
      // emails
      ok.push(item[2]);

      if (maxValue < item[2]) {
        maxValue = item[2];
      }
      if (maxValue < item[3]) {
        maxValue = item[3];
      }
    });

    var lineChartOptions = {
      scaleLineColor : '#AF1418',
      scaleGridLineColor : 'rgba(198, 23, 28, 0.4)',
      scaleFontColor : '#F2F2F2',
      scaleFontFamily : 'Open Sans',
      datasetStrokeWidth : 2,
      datasetFill : false,
      pointDot : false,
      scaleOverride : true,
      scaleSteps : 10,
      scaleStepWidth : Math.ceil(maxValue / 9)
    };
    var lineChartData = {
      labels : labels,
      datasets : [
        { strokeColor : '#FFCE4B', data : spam },
        { strokeColor : '#FFFFFF', data : ok }]
    };
    var myLine = new Chart(document.getElementById('dashgraph').getContext('2d')).Line(lineChartData, lineChartOptions);

    return myLine;
  };
  // load dashboard from http data

  var request = httpplease.use(httppleaseplugins.json);
  request.get('/api/graph/' + form_id + '?token=' + form_token, function (err, res) {
      if (err) {
        throw err;
      }
      var responseData = res.body;

      if (responseData && responseData.status === 'ok') {
        _loadData(responseData.data);
      }
  });
};