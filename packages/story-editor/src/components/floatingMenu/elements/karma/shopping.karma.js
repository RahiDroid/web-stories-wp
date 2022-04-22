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
 * Internal dependencies
 */
import { Fixture } from '../../../../karma';
import { useStory } from '../../../../app/story';

describe('Shopping integration', () => {
  let fixture;

  async function insertProduct(product) {
    await fixture.editor.library.shoppingTab.click();
    await fixture.events.keyboard.press('tab');

    expect(document.activeElement.getAttribute('aria-label')).toBe('Product');
    const productBtn = fixture.screen.getByRole('button', {
      name: /Product/,
    });
    await fixture.events.click(productBtn);

    const searchInput = fixture.screen.getByPlaceholderText('Search');
    await fixture.events.focus(searchInput);
    await fixture.events.keyboard.type(product);
    await fixture.events.keyboard.press('ArrowDown');
    await fixture.events.keyboard.press('Enter');

    const insertProductBtn = fixture.screen.getByRole('button', {
      name: /Insert product/,
    });
    await fixture.events.click(insertProductBtn);
  }

  beforeEach(async () => {
    fixture = new Fixture();
    fixture.setFlags({ shoppingIntegration: true });
    fixture.setFlags({ floatingMenu: true });
    await fixture.render();
    await fixture.collapseHelpCenter();
  });

  afterEach(() => {
    fixture.restore();
  });

  const getSelectedElement = async () => {
    const storyContext = await fixture.renderHook(() => useStory());
    return storyContext.state.selectedElements[0];
  };

  describe('Floating menu', () => {
    it('should render products menu', async () => {
      const productTitle = 'Album';
      await insertProduct(productTitle);
      const selectedElement = await getSelectedElement();
      await expect(selectedElement?.product?.productTitle).toBe(productTitle);
    });

    it('should update selected product via floating menu', async () => {
      const productTitle = 'Beanie with Logo';
      const newProductTitle = 'Single';
      await insertProduct(productTitle);
      await getSelectedElement();
      const productSelector = fixture.querySelector(
        '[aria-label="Design menu"] [aria-label="Product"]'
      );
      await fixture.events.mouse.clickOn(productSelector, 1, 1);
      await fixture.events.keyboard.type(newProductTitle);
      await fixture.events.keyboard.press('ArrowDown');
      await fixture.events.keyboard.press('Enter');
      const selectedElement = await getSelectedElement();
      await expect(selectedElement?.product?.productTitle).toBe(
        newProductTitle
      );
    });
  });
});
