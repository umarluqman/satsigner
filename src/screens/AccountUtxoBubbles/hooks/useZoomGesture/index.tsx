import React, { useCallback, useMemo, useRef } from 'react';
import { LayoutChangeEvent } from 'react-native';
import {
  ComposedGesture,
  Gesture,
  GestureStateChangeEvent,
  GestureTouchEvent,
  GestureUpdateEvent,
  PanGestureHandlerEventPayload,
  PinchGestureHandlerEventPayload,
  State
} from 'react-native-gesture-handler';
import { GestureStateManagerType } from 'react-native-gesture-handler/lib/typescript/handlers/gestures/gestureStateManager';
import {
  SharedValue,
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming
} from 'react-native-reanimated';
import { MAX_SCALE, MIN_SCALE } from './constants';
import { clampScale } from './utils';

interface UseZoomGestureProps {
  animationFunction?: typeof withTiming;
  animationConfig?: object;
  doubleTapConfig?: {
    defaultScale?: number;
  };
}

interface UseZoomGestureReturn {
  zoomGesture: ComposedGesture;
  contentContainerAnimatedStyle: any;
  onLayout(event: LayoutChangeEvent): void;
  onLayoutContent(event: LayoutChangeEvent): void;
  transform: Readonly<SharedValue<any>>;
}

export function useZoomGesture(
  props: UseZoomGestureProps = {}
): UseZoomGestureReturn {
  const {
    animationFunction = withTiming,
    animationConfig,
    doubleTapConfig
  } = props;

  const baseScale = useSharedValue(1);
  const pinchScale = useSharedValue(1);
  const lastScale = useSharedValue(1);
  const isZoomedIn = useSharedValue(false);
  const zoomGestureLastTime = useSharedValue(0);

  const containerDimensions = useSharedValue({ width: 0, height: 0 });
  const contentDimensions = useSharedValue({ width: 1, height: 1 });

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const lastOffsetX = useSharedValue(0);
  const lastOffsetY = useSharedValue(0);
  const panStartOffsetX = useSharedValue(0);
  const panStartOffsetY = useSharedValue(0);

  const handlePanOutsideTimeoutId: React.MutableRefObject<
    NodeJS.Timeout | undefined
  > = useRef();

  const withAnimation = useCallback(
    (toValue: number, config?: object) => {
      'worklet';

      return animationFunction(toValue, {
        duration: 350,
        ...config,
        ...animationConfig
      });
    },
    [animationFunction, animationConfig]
  );

  const getContentContainerSize = useCallback(() => {
    return {
      width: containerDimensions.value.width,
      height:
        (contentDimensions.value.height * containerDimensions.value.width) /
        contentDimensions.value.width
    };
  }, [containerDimensions, contentDimensions]);

  const zoomIn = useCallback((): void => {
    const newScale = doubleTapConfig?.defaultScale ?? MIN_SCALE;

    const clampedScale = clampScale(newScale, MIN_SCALE, MAX_SCALE);

    lastScale.value = clampedScale;

    baseScale.value = withAnimation(newScale);
    pinchScale.value = withAnimation(1);

    const newOffsetX = 0;
    lastOffsetX.value = newOffsetX;

    const newOffsetY = 0;
    lastOffsetY.value = newOffsetY;

    translateX.value = newOffsetX;
    translateY.value = newOffsetY;

    isZoomedIn.value = true;
  }, [
    baseScale,
    pinchScale,
    lastOffsetX,
    lastOffsetY,
    translateX,
    translateY,
    isZoomedIn,
    lastScale,
    getContentContainerSize,
    withAnimation,
    doubleTapConfig
  ]);

  const zoomOut = useCallback((): void => {
    const newScale = 1;
    lastScale.value = newScale;

    baseScale.value = withAnimation(newScale);
    pinchScale.value = withAnimation(1);

    const newOffsetX = 0;
    lastOffsetX.value = newOffsetX;

    const newOffsetY = 0;
    lastOffsetY.value = newOffsetY;

    translateX.value = withAnimation(newOffsetX);
    translateY.value = withAnimation(newOffsetY);

    isZoomedIn.value = false;
  }, [
    baseScale,
    pinchScale,
    lastOffsetX,
    lastOffsetY,
    translateX,
    translateY,
    lastScale,
    isZoomedIn,
    withAnimation
  ]);

  const handlePanOutside = useCallback((): void => {
    if (handlePanOutsideTimeoutId.current !== undefined)
      clearTimeout(handlePanOutsideTimeoutId.current);

    handlePanOutsideTimeoutId.current = setTimeout((): void => {
      const { width, height } = getContentContainerSize();
      const maxOffset = {
        x:
          width * lastScale.value < containerDimensions.value.width
            ? 0
            : (width * lastScale.value - containerDimensions.value.width) /
              2 /
              lastScale.value,
        y:
          height * lastScale.value < containerDimensions.value.height
            ? 0
            : (height * lastScale.value - containerDimensions.value.height) /
              2 /
              lastScale.value
      };

      const isPanedXOutside =
        lastOffsetX.value > maxOffset.x || lastOffsetX.value < -maxOffset.x;
      if (isPanedXOutside) {
        const newOffsetX = lastOffsetX.value >= 0 ? maxOffset.x : -maxOffset.x;
        lastOffsetX.value = newOffsetX;

        translateX.value = withAnimation(newOffsetX);
      } else {
        translateX.value = lastOffsetX.value;
      }

      const isPanedYOutside =
        lastOffsetY.value > maxOffset.y || lastOffsetY.value < -maxOffset.y;
      if (isPanedYOutside) {
        const newOffsetY = lastOffsetY.value >= 0 ? maxOffset.y : -maxOffset.y;
        lastOffsetY.value = newOffsetY;

        translateY.value = withAnimation(newOffsetY);
      } else {
        translateY.value = lastOffsetY.value;
      }
    }, 10);
  }, [
    lastOffsetX,
    lastOffsetY,
    lastScale,
    translateX,
    translateY,
    containerDimensions,
    getContentContainerSize,
    withAnimation
  ]);

  const onDoubleTap = useCallback((): void => {
    if (isZoomedIn.value) zoomOut();
    else zoomIn();
  }, [zoomIn, zoomOut, isZoomedIn]);

  // getting the container dimensions
  const onLayout = useCallback(
    ({
      nativeEvent: {
        layout: { width, height }
      }
    }: LayoutChangeEvent): void => {
      containerDimensions.value = {
        width,
        height
      };
    },
    [containerDimensions]
  );

  // getting the content dimensions
  const onLayoutContent = useCallback(
    ({
      nativeEvent: {
        layout: { width, height }
      }
    }: LayoutChangeEvent): void => {
      contentDimensions.value = {
        width,
        height
      };
    },
    [contentDimensions]
  );

  const onPinchEnd = useCallback(
    (scale: number): void => {
      const newScale = lastScale.value * scale;
      lastScale.value = newScale;
      if (newScale > 1) {
        isZoomedIn.value = true;
        baseScale.value = newScale;
        pinchScale.value = 1;

        handlePanOutside();
      } else {
        zoomOut();
      }
    },
    [lastScale, baseScale, pinchScale, handlePanOutside, zoomOut, isZoomedIn]
  );

  const updateZoomGestureLastTime = useCallback((): void => {
    'worklet';

    zoomGestureLastTime.value = Date.now();
  }, [zoomGestureLastTime]);

  const zoomGesture = useMemo(() => {
    const tapGesture = Gesture.Tap()
      .numberOfTaps(2)
      .onStart(() => {
        updateZoomGestureLastTime();
      })
      .onEnd(() => {
        updateZoomGestureLastTime();

        runOnJS(onDoubleTap)();
      })
      .maxDeltaX(25)
      .maxDeltaY(25);

    const panGesture = Gesture.Pan()
      .onStart(
        (event: GestureUpdateEvent<PanGestureHandlerEventPayload>): void => {
          updateZoomGestureLastTime();

          const { translationX, translationY } = event;

          panStartOffsetX.value = translationX;
          panStartOffsetY.value = translationY;
        }
      )
      .onUpdate(
        (event: GestureUpdateEvent<PanGestureHandlerEventPayload>): void => {
          updateZoomGestureLastTime();

          let { translationX, translationY } = event;

          translationX -= panStartOffsetX.value;
          translationY -= panStartOffsetY.value;

          translateX.value = lastOffsetX.value + translationX / lastScale.value;
          translateY.value = lastOffsetY.value + translationY / lastScale.value;
        }
      )
      .onEnd(
        (
          event: GestureStateChangeEvent<PanGestureHandlerEventPayload>
        ): void => {
          updateZoomGestureLastTime();

          let { translationX, translationY } = event;

          translationX -= panStartOffsetX.value;
          translationY -= panStartOffsetY.value;

          // Saves last position
          lastOffsetX.value =
            lastOffsetX.value + translationX / lastScale.value;
          lastOffsetY.value =
            lastOffsetY.value + translationY / lastScale.value;

          runOnJS(handlePanOutside)();
        }
      )
      .onTouchesMove(
        (e: GestureTouchEvent, state: GestureStateManagerType): void => {
          if (([State.UNDETERMINED, State.BEGAN] as State[]).includes(e.state))
            if (isZoomedIn.value || e.numberOfTouches === 2) state.activate();
            else state.fail();
        }
      )
      .onFinalize(() => {})
      .minDistance(0)
      .minPointers(2)
      .maxPointers(2);

    const pinchGesture = Gesture.Pinch()
      .onStart(() => {
        updateZoomGestureLastTime();
      })
      .onUpdate(
        ({
          scale
        }: GestureUpdateEvent<PinchGestureHandlerEventPayload>): void => {
          updateZoomGestureLastTime();

          pinchScale.value = scale;
        }
      )
      .onEnd(
        ({
          scale
        }: GestureUpdateEvent<PinchGestureHandlerEventPayload>): void => {
          updateZoomGestureLastTime();

          pinchScale.value = scale;

          runOnJS(onPinchEnd)(scale);
        }
      )
      .onFinalize(() => {});

    return Gesture.Simultaneous(tapGesture, panGesture, pinchGesture);
  }, [
    handlePanOutside,
    lastOffsetX,
    lastOffsetY,
    onDoubleTap,
    onPinchEnd,
    pinchScale,
    translateX,
    translateY,
    lastScale,
    isZoomedIn,
    panStartOffsetX,
    panStartOffsetY,
    updateZoomGestureLastTime
  ]);

  // Styles for the Animated View on top of Skia element
  const contentContainerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: baseScale.value * pinchScale.value },
      { translateX: translateX.value },
      { translateY: translateY.value }
    ]
  }));

  // Transform for the Skia element
  const transform = useDerivedValue(() => {
    return [
      { scale: baseScale.value * pinchScale.value },
      { translateX: translateX.value },
      { translateY: translateY.value }
    ];
  });

  return {
    zoomGesture,
    contentContainerAnimatedStyle,
    onLayout,
    onLayoutContent,
    transform
  };
}
