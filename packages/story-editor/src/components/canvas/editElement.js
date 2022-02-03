/*
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * External dependencies
 */
import { memo, useState, forwardRef } from '@googleforcreators/react';
import PropTypes from 'prop-types';
import styled from 'styled-components';
import { useUnits } from '@googleforcreators/units';
import { getDefinitionForType } from '@googleforcreators/elements';
import {
  elementWithPosition,
  elementWithSize,
  elementWithRotation,
} from '@googleforcreators/element-library';

/**
 * Internal dependencies.
 */
import useCORSProxy from '../../utils/useCORSProxy';
import { useConfig } from '../../app';
import useVideoTrim from '../videoTrim/useVideoTrim';
import { useStory, useFont } from '../../app';

const Wrapper = styled.div`
  ${elementWithPosition}
  ${elementWithSize}
  ${elementWithRotation}
  pointer-events: initial;
`;

const EditElement = memo(
  forwardRef(function EditElement({ element, editWrapper, onResize }, ref) {
    const { id, type } = element;
    const { getBox } = useUnits((state) => ({
      getBox: state.actions.getBox,
    }));
    const { getProxiedUrl } = useCORSProxy();
    const { isRTL } = useConfig();
    const {
      actions: { maybeEnqueueFontStyle },
    } = useFont();

    // Update the true global properties of the current element
    // This now only happens on unmount
    const { updateElementById } = useStory((state) => ({
      updateElementById: state.actions.updateElementById,
    }));
    const { isTrimMode, resource, setVideoNode } = useVideoTrim(
      ({ state: { isTrimMode, videoData }, actions: { setVideoNode } }) => ({
        isTrimMode,
        setVideoNode,
        resource: videoData?.resource,
      })
    );

    // Needed for elements that can scale in edit mode.
    const [localProperties, setLocalProperties] = useState(null);

    const { Edit } = getDefinitionForType(type);
    const elementWithLocal = localProperties
      ? { ...element, ...localProperties }
      : element;
    const box = getBox(elementWithLocal);

    return (
      <Wrapper aria-labelledby={`layer-${id}`} {...box} ref={ref}>
        <Edit
          element={elementWithLocal}
          box={box}
          editWrapper={editWrapper}
          onResize={onResize}
          setLocalProperties={setLocalProperties}
          getProxiedUrl={ getProxiedUrl }
          isRTL={ isRTL }
          isTrimMode={ isTrimMode }
          resource={ resource }
          setVideoNode={ setVideoNode }
          updateElementById={updateElementById}
          maybeEnqueueFontStyle={maybeEnqueueFontStyle}
        />
      </Wrapper>
    );
  })
);

EditElement.propTypes = {
  element: PropTypes.object.isRequired,
  editWrapper: PropTypes.object,
  onResize: PropTypes.func,
};

export default EditElement;
