import util from './util';
import uav from './uav';
import parseHtml from './parse/html';
import model from './model';
import component from './component';

if (!Array.from) {

    Array.from = function(object) {

        return [].slice.call(object);

    };

}

util.setTag('{', '}');

uav.component = component;
uav.model = model;
uav.parse = parseHtml;
uav.setTag = util.setTag;

window.uav = uav;
