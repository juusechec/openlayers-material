(function() {
  console.log('generalReport no window env');
  window.generalReport = {
    loadInterfaces: loadInterfaces,
    validateData: validateData
  }

  function displayMessage(msj) {
    $('#message-modal1').html(msj);
    $('#modal1').modal('open');
  }

  function loadInterfaces() {
    var layersSelect = $('#select_layers');
    layersSelect.html('');
    layersSelect.append($('<option value="" selected>Seleccione la opción</option>'));

    var layers = map.getLayers().getArray();
    for (var i = 0; i < layers.length; i++) {
      var layer = layers[i];
      var source = layer.getSource();
      if (typeof(source.config) !== 'undefined') {
        var type = source.config.serviceType;
        if (type === 'WFS') {
          var option = $('<option value="' + source.config.id + '">' + source.config.name + '</option>');
          layersSelect.append(option);
        }
      }
    }
    layersSelect.on('change', function() {
      console.log('onChange', this.value);
      loadFields(this.value);
    });
    layersSelect.material_select();
  };

  function loadFields(layerId) {
    var fieldsSelect = $('#select_fields');
    fieldsSelect.html('');
    fieldsSelect.append($('<option value="" selected>Seleccione</option>'));

    var layer = map.getLayer(layerId);
    var source = layer.getSource();
    var config = source.config;

    $.getJSON(config.url + '&maxFeatures=1', function(response) {
      console.log('response', response);
      if (response.features.length > 0) {
        var feature = response.features[0];
        var properties = feature.properties;
        for (var property in properties) {
          console.log(property);
          if (properties.hasOwnProperty(property)) {
            if (['geometry'].indexOf(property) === -1) { //Si no esta
              var option = $('<option value="' + property + '">' + property + '</option>');
              fieldsSelect.append(option);
            }
          }
        }
        fieldsSelect.material_select();
      } else {
        displayMessage('No hay resultados.');
      }
    }).fail(function(jqxhr, textStatus, error) {
      displayMessage('Error: ¿Está bien su conexión a internet?. Reporte al administrador con una captura: ' + error);
    });
  }

  function validateData(evt) {
    if ($('#select_layers').val() === '' || $('#select_fields').val() === '') {
      displayMessage('Por favor seleccione valores.');
    } else {
      consultarFeatures();
    }
  }

  function consultarFeatures() {
    var layerId = $('#select_layers').val();
    var field = $('#select_fields').val();
    var operator = $('#select_operator').val();
    var value = $('#row_value').val();

    var layer = map.getLayer(layerId);
    var source = layer.getSource();
    var config = source.config;

    ///geoserver/SIGUD/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=SIGUD:Localidades
    //&outputFormat=application%2Fjson&cql_filter=NOMBRE=%27SANTA%20FE%27
    var cql_filter = generateCQL_FILTER(field, operator, value);
    $('#cql_filter').html(cql_filter);
    cql_filter = encodeURI(cql_filter);
    console.log(window.location.origin + config.url + '&cql_filter=' + cql_filter);

    $.getJSON(config.url + '&cql_filter=' + cql_filter, function(response) {
      console.log('response', response);
      showResultFeaturesGeneralReport(response);
    }).fail(function(jqxhr, textStatus, error) {
      displayMessage('Error: ¿Está bien su conexión a internet?. Reporte al administrador con una captura: ' + error);
    });
  }

  function generateCQL_FILTER(field, operator, value) {
    // please see http://docs.geoserver.org/stable/en/user/tutorials/cql/cql_tutorial.html
    var op = '';
    switch (operator) {
      case 'equals':
        op = '=';
        break;
      case 'distinct':
        op = '<>';
        break;
      case 'mayor':
        op = '>';
        break;
      case 'minor':
        op = '<';
        break;
      case 'mayorequals':
        op = '>=';
        break;
      case 'minorequals':
        op = '<=';
        break;
      case 'like':
        op = ' LIKE ';
        break;
      case 'between':
        op = ' BETWEEN ';
        break;
      case 'in':
        op = ' IN ';
        break;
      default:
        op = '';
    }

    if (value == Number(value)) {
      value = value;
    } else {
      if ( value.toUpperCase().indexOf('AND') > 0 || value.toUpperCase().indexOf('OR') > 0 ) { // si esta OR o AND
        // var regex = /[Aa][Nn][Dd]/g;
        // value = value.replace(regex, "AND");
      } else {
        var regex = /^'/g;
        value = value.replace(regex, '');
        regex = /'$/g;
        value = value.replace(regex, '');
        value = "'" + value + "'";
      }
    }

    var cql_filter = field + op + value;
    return cql_filter;
  }

  function showResultFeaturesGeneralReport(response) {
    var containerHTML = $('#generalReportResultsDiv');
    containerHTML.html('');
    var features = response.features;
    if (features.length > 0) {
      for (var j = 0; j < features.length; j++) {
        var feature = features[j];
        var properties = feature.properties;
        for (var property in properties) {
          if (properties.hasOwnProperty(property)) {
            if (['geometry'].indexOf(property) === -1) { //Si no esta
              var propertySpan = $('<span><b>' + property + ':</b> ' + properties[property] + '</span>');
              containerHTML.append(propertySpan);
              containerHTML.append($('<br/>'));
            }
          }
        }
        var geometrySpan = $('<span><a href="#">Acercar a</a></span>');

        window.geometry = feature.geometry;
        feature.geometry = parseGeometry(feature.geometry);
        geometrySpan[0].geometry = feature.geometry;
        geometrySpan.click(function() {
          mapTools.cleanMap();
          mapTools.zoomToGeometry(this.geometry);
          consultas.addGeometryHighlight(this.geometry);
        });
        containerHTML.append(geometrySpan);
        containerHTML.append($('<br/>'));
        containerHTML.append($('<br/>'));
      }
    } else {
      var item = $('<span>No hay resultados.</span>');
      containerHTML.append(item);
    }
  }

  function parseGeometry(rawGeometry) {
    var geometries = {
      'Point': new ol.geom.Point(rawGeometry.coordinates),
      'LineString': new ol.geom.LineString(rawGeometry.coordinates),
      'MultiLineString': new ol.geom.MultiLineString(rawGeometry.coordinates),
      'MultiPoint': new ol.geom.MultiPoint(rawGeometry.coordinates),
      'MultiPolygon': new ol.geom.MultiPolygon(rawGeometry.coordinates),
      'Polygon': new ol.geom.Polygon(rawGeometry.coordinates),
      'GeometryCollection': new ol.geom.GeometryCollection(rawGeometry.opt_geometries),
      'Circle': new ol.geom.Circle(rawGeometry.center)
    };

    return geometries[rawGeometry.type];
  }

})();
