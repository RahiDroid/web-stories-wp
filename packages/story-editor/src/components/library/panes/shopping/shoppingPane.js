/*
 * Copyright 2022 Google LLC
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
import { useFeature } from 'flagged';
import styled, { css } from 'styled-components';
import {
  useCallback,
  useState,
  useEffect,
  forwardRef,
} from '@googleforcreators/react';
import { __ } from '@googleforcreators/i18n';
import {
  Text,
  THEME_CONSTANTS,
  Search,
  Icons,
  Button,
  BUTTON_TYPES,
  BUTTON_SIZES,
  BUTTON_VARIANTS,
  noop,
} from '@googleforcreators/design-system';

/**
 * Internal dependencies
 */
import { Section } from '../../common';
import { useAPI } from '../../../../app';
import { Row } from '../../../form';
import useLibrary from '../../useLibrary';
import { Pane } from '../shared';
import { useStory } from '../../../../app/story';
import paneId from './paneId';

const containerStyleOverrides = css`
  background-color: transparent;
  border: none;
`;

const StyledListItem = styled.li`
  border: none;
  background: 'transparent';
  position: relative;
  overflow: hidden;
`;

const StyledProductContainer = styled.div`
  display: flex;
  padding: 5px 0;
  align-items: center;
  border-bottom: 2px solid ${({ theme }) => theme.colors.divider.tertiary};
`;

const StyledProductButton = styled.div`
  margin-right: 10px;
  button {
    width: 16px;
    height: 16px;
    margin-right: 10px;
  }

  .check {
    color: ${({ theme }) => theme.colors.fg.positive};
  }

  .remove {
    color: ${({ theme }) => theme.colors.fg.negative};
    display: none;
  }

  &:hover {
    .remove {
      display: block;
    }

    .check {
      display: none;
    }
  }
`;

const basePlaceholder = css`
  display: block;
  margin-right: 10px;
  border-radius: 4px;
  background-color: ${({ theme }) => theme.colors.interactiveBg.disable};
  width: 41px;
  height: 41px;
`;

const StyledProductPlaceHolder = styled.div`
  ${basePlaceholder}
`;

const StyledProductImage = styled.img`
  ${basePlaceholder}
`;

const StyledProductDescription = styled.div`
  padding-left: 12px;
`;

const StyledProductName = styled(Text).attrs({
  size: THEME_CONSTANTS.TYPOGRAPHY.PRESET_SIZES.MEDIUM,
})`
  color: ${({ theme }) => theme.colors.fg.primary};
`;

const StyledPrice = styled(Text)`
  color: ${({ theme }) => theme.colors.fg.tertiary};
`;

const HelperText = styled(Text).attrs({
  size: THEME_CONSTANTS.TYPOGRAPHY.PRESET_SIZES.SMALL,
})`
  color: ${({ theme }) => theme.colors.fg.secondary};
`;

// @todo fully replace this to handle multiple currencies etc...
function tempFormatCurrency(num) {
  const total = Number(num).toFixed(
    Math.max(num.toString().split('.')[1]?.length, 2) || 2
  );
  return `$${total}`;
}

function ShoppingPane(props) {
  const isEnabled = useFeature('shoppingIntegration');
  const [pageProducts, setPageProducts] = useState([]);
  const [options, setOptions] = useState([]);
  const {
    actions: { getProducts },
  } = useAPI();

  const { storyPages, deleteElementById } = useStory(
    ({ state: { pages }, actions }) => ({
      storyPages: pages,
      deleteElementById: actions.deleteElementById,
    })
  );

  useEffect(() => {
    const products = [];
    storyPages.forEach((page) => {
      page.elements.forEach((element) => {
        if (element?.type === 'product') {
          products.push({
            elementId: element.id,
            productId: element.product.productId,
          });
        }
      });
    });
    setPageProducts(products);
  }, [storyPages]);

  const getProductsByQuery = useCallback(
    async (value) => {
      const products = await getProducts(value);
      setOptions(
        products.map((p) => ({
          label: p.productTitle,
          value: p.productTitle,
          product: p,
        }))
      );
    },
    [getProducts]
  );

  const { insertElement } = useLibrary((state) => ({
    insertElement: state.actions.insertElement,
  }));

  const deleteProduct = useCallback(
    (product) => {
      const element = pageProducts.find(
        (item) => item.productId === product.productId
      );
      if (element) {
        deleteElementById({ elementId: element.elementId });
      }
    },
    [deleteElementById, pageProducts]
  );

  const insertProduct = useCallback(
    (product) => {
      insertElement('product', {
        width: 25,
        height: 25,
        product,
      });
    },
    [insertElement]
  );

  if (!isEnabled) {
    return null;
  }

  const RenderItemOverride = forwardRef(
    ({ option, isSelected, ...rest }, ref) => {
      const onPage = pageProducts.find(
        (item) => item.productId === option?.product.productId
      );
      const activeIcon = (
        <>
          <Icons.ProductCheck className="check" />{' '}
          <Icons.ProductRemove className="remove" />
        </>
      );

      const handleClick = onPage
        ? () => {
            deleteProduct(option?.product);
          }
        : () => {
            insertProduct(option?.product);
          };
      const src = option?.product?.productImages[0]?.url || '';
      return (
        // eslint-disable-next-line styled-components-a11y/click-events-have-key-events -- click events in the contained buttons.
        <StyledListItem
          ref={ref}
          width={option.width}
          active={isSelected}
          {...rest}
          onClick={null}
        >
          <StyledProductContainer>
            <StyledProductButton>
              <Button
                aria-label={__('Add', 'web-stories')}
                onClick={handleClick}
                type={BUTTON_TYPES.TERTIARY}
                size={BUTTON_SIZES.SMALL}
                variant={BUTTON_VARIANTS.SQUARE}
              >
                {onPage ? activeIcon : <Icons.ProductPlus />}
              </Button>
            </StyledProductButton>
            {src ? (
              <StyledProductImage
                alt={option?.product?.productTitle}
                src={src}
              />
            ) : (
              <StyledProductPlaceHolder />
            )}
            <StyledProductDescription>
              <StyledProductName isBold>{option.label}</StyledProductName>
              <StyledPrice>
                {tempFormatCurrency(option.product.productPrice)}
              </StyledPrice>
            </StyledProductDescription>
          </StyledProductContainer>
        </StyledListItem>
      );
    }
  );

  return (
    <Pane id={paneId} {...props}>
      <Section
        data-testid="shapes-library-pane"
        title={__('Products', 'web-stories')}
      >
        <Row>
          <HelperText>
            {__(
              'This will add products as a tappable dot on your story.',
              'web-stories'
            )}
          </HelperText>
        </Row>
        <Row>
          <Search
            menuStylesOverride={containerStyleOverrides}
            placeholder={'search'}
            selectedValue={null}
            onMenuItemClick={null}
            onClear={noop}
            options={options}
            handleSearchValueChange={getProductsByQuery}
            emptyText={__('No options available', 'web-stories')}
            renderItem={RenderItemOverride}
          />
        </Row>
      </Section>
    </Pane>
  );
}

export default ShoppingPane;
