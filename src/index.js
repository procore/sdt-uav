import util from './util';
import uav from './uav';
import parse from './parse';
import model from './model';
import component from './component';

util.setTag('{', '}');

uav.parse = parse.html;
uav.component = component;
uav.model = model;
