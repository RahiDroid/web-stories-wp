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
import { readdirSync, readFileSync } from 'fs';
import { resolve } from 'path';

describe('raw template files', () => {
  const templates = readdirSync(
    resolve(process.cwd(), 'packages/templates/src/raw')
  );

  // @see https://github.com/google/web-stories-wp/issues/2473#issuecomment-651509687
  it.each(templates)(
    '%s template should not contain invisible characters',
    (template) => {
      const templateContent = readFileSync(
        resolve(
          process.cwd(),
          `packages/templates/src/raw/${template}/template.json`
        ),
        'utf8'
      );

      expect(templateContent).not.toContain('\u2028');
    }
  );

  // @see https://github.com/google/web-stories-wp/pull/4516
  // @see https://github.com/google/web-stories-wp/pull/6159
  it.each(templates)(
    '%s template should contain replaceable URLs',
    async (template) => {
      const { default: templateData } = await import(
        /* webpackChunkName: "chunk-web-stories-template-[index]" */ `../raw/${template}`
      );

      for (const { elements } of templateData.pages) {
        for (const element of elements) {
          if (!element?.resource?.src) {
            continue;
          }

          expect(element?.resource?.src).toStartWith(
            `__WEB_STORIES_TEMPLATE_BASE_URL__/images/templates/${template}`
          );
        }
      }
    }
  );

  // @see https://github.com/google/web-stories-wp/pull/5889
  it.each(templates)(
    '%s template should contain pageTemplateType',
    async (template) => {
      const { default: templateData } = await import(
        /* webpackChunkName: "chunk-web-stories-template-[index]" */ `../raw/${template}`
      );

      for (const page of templateData.pages) {
        expect(page).toStrictEqual(
          expect.objectContaining({
            pageTemplateType: expect.any(String),
          })
        );
      }
    }
  );

  // @see https://github.com/google/web-stories-wp/issues/7227
  it.each(templates)(
    '%s template should not contain extraneous properties',
    async (template) => {
      const { default: templateData } = await import(
        /* webpackChunkName: "chunk-web-stories-template-[index]" */ `../raw/${template}`
      );

      expect(templateData.current).toBeNull();
      expect(templateData.selection).toStrictEqual([]);
      expect(templateData.story.globalStoryStyles).toBeUndefined();
    }
  );
});
