import constant from "./constant";
import noop from "./noop";
import {event, select, mouse, touch} from "d3-selection";

function nodefault() {
  event.preventDefault();
}

// Ignore right-click, since that should open the context menu.
// Ignore multiple starting touches on the same element.
function defaultFilter(id) {
  return !event.button && (id == null || event.changedTouches[0].identifier === id);
}

function defaultContainer() {
  return this.parentNode;
}

// Listen to the window for mousemove and mouseup such that we continue to
// receive events if the mouse goes outside the window.
function mouseContext() {
  return event.view;
}

// Listen to the event target for touchmove, touchend and touchcancel.
function touchContext() {
  return event.target;
}

export default function(dragstarted) {
  var filter = defaultFilter,
      container = defaultContainer,
      mousestart = start("mousemove", "mouseup", mouse, mouseContext),
      touchstart = start("touchmove", "touchend touchcancel", touch, touchContext);

  function drag(selection) {
    selection
        .on("mousedown.drag", mousedowned)
        .on("touchstart.drag", touchstarted);
  }

  function mousedowned() {
    if (filter.call(this)) {
      mousestart.call(this);
    }
  }

  function touchstarted() {
    for (var touches = event.changedTouches, i = 0, n = touches.length, id; i < n; ++i) {
      if (filter.call(this, id = touches[i].identifier)) {
        touchstart.call(this, id);
      }
    }
  }

  function start(move, end, position, contextify) {
    return function(id) {
      var node = this,
          parent = container.call(node, id),
          p0 = position(parent, id),
          listen = dragstarted.call(node, p0[0], p0[1], id) || noop,
          dragged = typeof listen === "function" ? listen : listen.drag || noop,
          dragended = listen.dragend || noop,
          noclick = false,
          view = select(event.view).on(name("dragstart selectstart"), nodefault, true),
          context = select(contextify()).on(name(move), moved).on(name(end), ended);

      // I’d like to call preventDefault on mousedown to disable native dragging
      // of links or images and native text selection. However, in Chrome this
      // causes mousemove and mouseup events outside an iframe to be dropped:
      // https://bugs.chromium.org/p/chromium/issues/detail?id=269917
      // And if you preventDefault on touchstart on iOS, it prevents the click
      // event on touchend, even if there was no touchmove! So instead, we
      // cancel the specific undesirable behaviors.

      function name(types) {
        var name = id == null ? ".drag" : ".drag-" + id;
        return types == null ? name : types.trim()
            .split(/^|\s+/)
            .map(function(type) { return type + name; })
            .join(" ");
      }

      function moved() {
        var p = position(parent, id);
        if (p == null) return; // This touch didn’t change.
        nodefault(), noclick = true;
        dragged.call(node, p[0], p[1], id);
      }

      function ended() {
        var p = position(parent, id);
        if (p == null) return; // This touch didn’t end.
        view.on(name(), null);
        context.on(name(), null);
        if (noclick) view.on(name("click"), nodefault, true), setTimeout(afterended, 0);
        dragended.call(node, p[0], p[1], id);
      }

      function afterended() {
        view.on(name("click"), null);
      }
    };
  }

  drag.filter = function(_) {
    return arguments.length ? (filter = typeof _ === "function" ? _ : constant(!!_), drag) : filter;
  };

  drag.container = function(_) {
    return arguments.length ? (container = typeof _ === "function" ? _ : constant(_), drag) : container;
  };

  return drag;
}
