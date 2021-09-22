/*
 * Copyright 2021 Google LLC
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
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from '@web-stories-wp/react';
/**
 * Internal dependencies
 */
import cleanForSlug from '../../utils/cleanForSlug';
import { useAPI } from '../api';
import { useStory } from '../story';
import Context from './context';
import {
  dictionaryOnKey,
  mapObjectVals,
  mergeNestedDictionaries,
  objectFromEntries,
  mapObjectKeys,
  cacheFromEmbeddedTerms,
} from './utils';

function TaxonomyProvider(props) {
  const [taxonomies, setTaxonomies] = useState([]);
  const [selectedSlugs, setSelectedSlugs] = useState({});
  const [termCache, setTermCache] = useState({});
  // Should grab categories on mount
  const [shouldRefetchCategories, setShouldRefetchCategories] = useState(true);
  const { updateStory, isStoryLoaded, terms, hasTaxonomies } = useStory(
    ({ state: { pages, story }, actions: { updateStory } }) => ({
      updateStory,
      isStoryLoaded: pages.length > 0,
      terms: story.terms,
      hasTaxonomies: story?.taxonomies?.length > 0,
    })
  );

  const { getTaxonomyTerm, createTaxonomyTerm, getTaxonomies } = useAPI(
    ({ actions }) => actions
  );

  // Get all registered `web-story` taxonomies.
  useEffect(() => {
    if (!hasTaxonomies) {
      return;
    }

    (async function () {
      try {
        const result = await getTaxonomies();

        setTaxonomies(result);
      } catch (e) {
        // Do we wanna do anything here?
      }
    })();
  }, [hasTaxonomies, getTaxonomies]);

  // Reference embedded terms in the story and taxonomies
  // to get the initial selected terms as well as populate
  // the taxonomy term cache
  const hasHydrationRunOnce = useRef(false);
  useEffect(() => {
    if (
      taxonomies.length > 0 &&
      isStoryLoaded &&
      !hasHydrationRunOnce.current
    ) {
      const taxonomiesBySlug = dictionaryOnKey(taxonomies, 'slug');
      const initialCache = mapObjectKeys(
        cacheFromEmbeddedTerms(terms),
        (slug) => taxonomiesBySlug[slug]?.restBase
      );
      const initialSelectedSlugs = mapObjectVals(initialCache, (val) =>
        Object.keys(val)
      );

      hasHydrationRunOnce.current = true;
      setTermCache(initialCache);
      setSelectedSlugs(initialSelectedSlugs);
    }
  }, [terms, isStoryLoaded, taxonomies, setSelectedSlugs, setTermCache]);

  // With the freeform taxonomy input, we can have terms selected
  // that may be in the process of being created or retrieved from
  // the backend. Because of this, we sync up our local selected slugs
  // with whatever cached terms are available at any given moment.
  useEffect(() => {
    if (!hasHydrationRunOnce.current) {
      return;
    }

    const termEntries = Object.entries(selectedSlugs).map(
      ([taxonomyRestBase, termSlugs = []]) => [
        taxonomyRestBase,
        termSlugs
          .map((termSlug) => termCache[taxonomyRestBase]?.[termSlug]?.id)
          .filter((id) => typeof id === 'number'),
      ]
    );
    const updatedTerms = objectFromEntries(termEntries);
    updateStory({
      properties: {
        terms: updatedTerms,
      },
    });
  }, [updateStory, selectedSlugs, termCache]);

  const addSearchResultsToCache = useCallback(
    async (
      taxonomy,
      {
        name,
        // This is the per_page value Gutenberg is using
        perPage = 20,
      }
    ) => {
      let response = [];
      const termsEndpoint = taxonomy['_links']?.['wp:items']?.[0]?.href;
      if (!termsEndpoint) {
        return;
      }
      try {
        response = await getTaxonomyTerm(termsEndpoint, {
          search: name,
          per_page: perPage,
        });
      } catch (e) {
        // Do we wanna do anything here?
      }

      // Avoid update if we're not actually adding any terms here
      if (response.length < 1) {
        return;
      }

      // Format results to fit in our { [taxonomy]: { [slug]: term } } map
      const termResults = {
        [taxonomy.restBase]: dictionaryOnKey(response, 'slug'),
      };
      setTermCache((cache) => mergeNestedDictionaries(cache, termResults));
    },
    [getTaxonomyTerm]
  );

  const createTerm = useCallback(
    async (taxonomy, termName, parentId) => {
      // make sure the term doesn't already exist locally
      if (termCache[taxonomy.restBase]?.[cleanForSlug(termName)]) {
        return;
      }

      const termsEndpoint = taxonomy['_links']?.['wp:items']?.[0]?.href;
      if (!termsEndpoint) {
        return;
      }

      // create term and add to cache
      try {
        const data = { name: termName };
        if (parentId) {
          data.parent = parentId;
        }

        const newTerm = await createTaxonomyTerm(termsEndpoint, data);
        const incomingCache = {
          [taxonomy.restBase]: { [newTerm.slug]: newTerm },
        };
        setTermCache((cache) => mergeNestedDictionaries(cache, incomingCache));
      } catch (e) {
        // If the backend says the term already exists
        // we fetch for it as well as related terms to
        // help more thoroughly populate our cache.
        //
        // We could pull down only the exact term, but
        // we're modeling after Gutenberg.
        if (e.code === 'term_exists') {
          addSearchResultsToCache(taxonomy, { name: termName });
        }
      }
    },
    [createTaxonomyTerm, termCache, addSearchResultsToCache]
  );

  const setSelectedTaxonomySlugs = useCallback(
    (taxonomy, termSlugs = []) =>
      setSelectedSlugs((selected) => ({
        ...selected,
        [taxonomy.restBase]:
          typeof termSlugs === 'function'
            ? termSlugs(selected[taxonomy.restBase])
            : termSlugs,
      })),
    []
  );

  // Fetch hierarchical taxonomies on mount
  useEffect(() => {
    // only fetch when `shouldRefetchCategories` is true
    if (shouldRefetchCategories && taxonomies?.length) {
      const hierarchicalTaxonomies = taxonomies.filter(
        (taxonomy) => taxonomy.hierarchical
      );
      hierarchicalTaxonomies.forEach((taxonomy) =>
        addSearchResultsToCache(taxonomy, { perPage: -1 })
      );

      setShouldRefetchCategories(false);
    }
  }, [addSearchResultsToCache, shouldRefetchCategories, taxonomies]);

  const value = useMemo(
    () => ({
      state: {
        taxonomies,
        termCache,
        selectedSlugs,
      },
      actions: {
        createTerm,
        addSearchResultsToCache,
        setSelectedTaxonomySlugs,
      },
    }),
    [
      taxonomies,
      createTerm,
      termCache,
      addSearchResultsToCache,
      selectedSlugs,
      setSelectedTaxonomySlugs,
    ]
  );

  return <Context.Provider {...props} value={value} />;
}

export default TaxonomyProvider;
