<?php
/**
 * Class Products_Controller
 *
 * @link      https://github.com/googleforcreators/web-stories-wp
 *
 * @copyright 2022 Google LLC
 * @license   https://www.apache.org/licenses/LICENSE-2.0 Apache License 2.0
 */

/**
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

namespace Google\Web_Stories\REST_API;

use Google\Web_Stories\Infrastructure\HasRequirements;
use Google\Web_Stories\Infrastructure\Injector;
use Google\Web_Stories\Interfaces\Product_Query;
use Google\Web_Stories\Model\Product;
use Google\Web_Stories\Product\Shopify_Query;
use Google\Web_Stories\Product\Woocommerce_Query;
use Google\Web_Stories\Settings;
use Google\Web_Stories\Story_Post_Type;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;
use WP_REST_Server;

/**
 * Class to access publisher logos via the REST API.
 *
 * @since 1.20.0
 */
class Products_Controller extends REST_Controller implements HasRequirements {

	/**
	 * Settings instance.
	 *
	 * @var Settings Settings instance.
	 */
	private $settings;

	/**
	 * Story_Post_Type instance.
	 *
	 * @var Story_Post_Type Story_Post_Type instance.
	 */
	private $story_post_type;

	/**
	 * Injector instance.
	 *
	 * @var Injector Injector instance.
	 */
	private $injector;

	/**
	 * Constructor.
	 *
	 * @param Settings        $settings Settings instance.
	 * @param Story_Post_Type $story_post_type Story_Post_Type instance.
	 * @param Injector        $injector Injector instance.
	 */
	public function __construct( Settings $settings, Story_Post_Type $story_post_type, Injector $injector ) {
		$this->settings        = $settings;
		$this->story_post_type = $story_post_type;
		$this->injector        = $injector;

		$this->namespace = 'web-stories/v1';
		$this->rest_base = 'products';
	}

	/**
	 * Get the list of service IDs required for this service to be registered.
	 *
	 * Needed because the story post type needs to be registered first.
	 *
	 * @since 1.20.0
	 *
	 * @return string[] List of required services.
	 */
	public static function get_requirements(): array {
		return [ 'settings', 'story_post_type' ];
	}

	/**
	 * Registers routes for links.
	 *
	 * @since 1.20.0
	 *
	 * @see register_rest_route()
	 */
	public function register_routes(): void {
		register_rest_route(
			$this->namespace,
			'/' . $this->rest_base,
			[
				[
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => [ $this, 'get_items' ],
					'permission_callback' => [ $this, 'get_items_permissions_check' ],
					'args'                => $this->get_collection_params(),
				],
				'schema' => [ $this, 'get_public_item_schema' ],
			]
		);
	}

	/**
	 * Checks if a given request has access to get and create items.
	 *
	 * @since 1.20.0
	 *
	 * @param WP_REST_Request $request Full details about the request.
	 * @return true|WP_Error True if the request has read access, WP_Error object otherwise.
	 */
	public function get_items_permissions_check( $request ) {
		if ( ! $this->story_post_type->has_cap( 'edit_posts' ) ) {
			return new \WP_Error(
				'rest_forbidden',
				__( 'Sorry, you are not allowed to manage publisher logos.', 'web-stories' ),
				[ 'status' => rest_authorization_required_code() ]
			);
		}

		return true;
	}

	/**
	 * Retrieves all products.
	 *
	 * @since 1.20.0
	 *
	 * @param WP_REST_Request $request Full details about the request.
	 * @return WP_REST_Response|WP_Error Response object on success, or WP_Error object on failure.
	 */
	public function get_items( $request ) {
		// TODO(#11154): Refactor to extract product query logic out of this controller.
		$shopify_host         = $this->settings->get_setting( Settings::SETTING_NAME_SHOPIFY_HOST );
		$shopify_access_token = $this->settings->get_setting( Settings::SETTING_NAME_SHOPIFY_ACCESS_TOKEN );

		$query = null;
		if ( ! empty( $shopify_host ) && ! empty( $shopify_access_token ) ) {
			$query = $this->injector->make( Shopify_Query::class );
		} elseif ( function_exists( 'wc_get_products' ) ) {
			$query = $this->injector->make( Woocommerce_Query::class );
		}

		if ( ! $query instanceof Product_Query ) {
			return new WP_Error( 'unable_to_find_class', __( 'Unable to find class', 'web-stories' ), [ 'status' => 400 ] );
		}

		/**
		 * Request context.
		 *
		 * @var string $search_term
		 */
		$search_term = ! empty( $request['search'] ) ? $request['search'] : '';
		$result      = $query->do_search( $search_term );
		if ( is_wp_error( $result ) ) {
			return $result;
		}
		$query_result = $query->get_results();

		$products = [];

		foreach ( $query_result as $product ) {
			$data       = $this->prepare_item_for_response( $product, $request );
			$products[] = $this->prepare_response_for_collection( $data );
		}

		return rest_ensure_response( $products );
	}

	/**
	 * Prepares a single post output for response.
	 *
	 * @SuppressWarnings(PHPMD.NPathComplexity)
	 *
	 * @since 1.20.0
	 *
	 * @param Product         $item    Project object.
	 * @param WP_REST_Request $request Request object.
	 * @return WP_REST_Response Response object.
	 */
	public function prepare_item_for_response( $item, $request ): WP_REST_Response {
		$product = $item;
		$fields  = $this->get_fields_for_response( $request );

		$data = [];

		if ( rest_is_field_included( 'productId', $fields ) ) {
			$data['productId'] = $product->get_id();
		}

		if ( rest_is_field_included( 'productTitle', $fields ) ) {
			$data['productTitle'] = $product->get_title();
		}

		if ( rest_is_field_included( 'productBrand', $fields ) ) {
			$data['productBrand'] = $product->get_brand();
		}

		if ( rest_is_field_included( 'productPrice', $fields ) ) {
			$data['productBrand'] = $product->get_price();
		}

		if ( rest_is_field_included( 'productCurrency', $fields ) ) {
			$data['productCurrency'] = $product->get_price_currency();
		}

		if ( rest_is_field_included( 'productDetails', $fields ) ) {
			$data['productDetails'] = $product->get_details();
		}

		if ( rest_is_field_included( 'productImages', $fields ) ) {
			$data['productImages'] = [];
			foreach ( $product->get_images() as $image ) {
				$image_data = [];
				if ( rest_is_field_included( 'productImages.url', $fields ) ) {
					$image_data['url'] = $image->get_url();
				}
				if ( rest_is_field_included( 'productImages.alt', $fields ) ) {
					$image_data['alt'] = $image->get_alt();
				}
				$data['productImages'][] = $image_data;
			}
		}

		if ( rest_is_field_included( 'aggregateRating', $fields ) ) {
			$data['aggregateRating'] = [];
		}

		if ( rest_is_field_included( 'aggregateRating.ratingValue', $fields ) ) {
			$data['aggregateRating']['ratingValue'] = (float) $product->get_aggregate_rating()->get_value();
		}
		if ( rest_is_field_included( 'aggregateRating.reviewCount', $fields ) ) {
			$data['aggregateRating']['reviewCount'] = (int) $product->get_aggregate_rating()->get_count();
		}
		if ( rest_is_field_included( 'aggregateRating.reviewUrl', $fields ) ) {
			$data['aggregateRating']['reviewUrl'] = $product->get_aggregate_rating()->get_url();
		}

		/**
		 * Request context.
		 *
		 * @var string $context
		 */
		$context = ! empty( $request['context'] ) ? $request['context'] : 'view';
		$data    = $this->add_additional_fields_to_object( $data, $request );
		$data    = $this->filter_response_by_context( $data, $context );

		/**
		 * Response object.
		 *
		 * @var WP_REST_Response $response
		 */
		$response = rest_ensure_response( $data );

		return $response;
	}

	/**
	 * Retrieves the publisher logo's schema, conforming to JSON Schema.
	 *
	 * @since 1.20.0
	 *
	 * @return array Item schema data.
	 */
	public function get_item_schema(): array {
		if ( $this->schema ) {
			return $this->add_additional_fields_schema( $this->schema );
		}

		$schema = [
			'$schema'    => 'http://json-schema.org/draft-04/schema#',
			'title'      => 'publisher-logo',
			'type'       => 'object',
			'properties' => [
				'productId'       => [
					'description' => __( 'Product ID.', 'web-stories' ),
					'type'        => 'integer',
					'context'     => [ 'view', 'edit', 'embed' ],
					'readonly'    => true,
				],
				'productTitle'    => [
					'description' => __( 'Product title.', 'web-stories' ),
					'type'        => 'string',
					'context'     => [ 'view', 'edit', 'embed' ],
					'readonly'    => true,
				],
				'productBrand'    => [
					'description' => __( 'Product brand.', 'web-stories' ),
					'type'        => 'string',
					'context'     => [ 'view', 'edit', 'embed' ],
					'readonly'    => true,
				],
				'productPrice'    => [
					'description' => __( 'Product price.', 'web-stories' ),
					'type'        => 'string',
					'context'     => [ 'view', 'edit', 'embed' ],
					'readonly'    => true,
				],
				'productCurrency' => [
					'description' => __( 'Product currency.', 'web-stories' ),
					'type'        => 'string',
					'context'     => [ 'view', 'edit', 'embed' ],
					'readonly'    => true,
				],
				'productImages'   => [
					'description' => __( 'Product brand.', 'web-stories' ),
					'type'        => 'array',
					'items'       => [
						'type'       => 'object',
						'properties' => [
							'url' => [
								'description' => __( 'Product image URL', 'web-stories' ),
								'type'        => 'string',
								'format'      => 'uri',
								'context'     => [ 'view', 'edit', 'embed' ],
							],
							'alt' => [
								'description' => __( 'Product image alt text', 'web-stories' ),
								'type'        => 'string',
								'context'     => [ 'view', 'edit', 'embed' ],
							],
						],
					],
					'context'     => [ 'view', 'edit', 'embed' ],
					'readonly'    => true,
				],
				'aggregateRating' => [
					'description' => __( 'Product rating.', 'web-stories' ),
					'type'        => 'object',
					'properties'  => [
						'ratingValue' => [
							'description' => __( 'Average rating.', 'web-stories' ),
							'type'        => 'number',
							'context'     => [ 'view', 'edit', 'embed' ],
						],
						'reviewCount' => [
							'description' => __( 'Number of reviews.', 'web-stories' ),
							'type'        => 'number',
							'context'     => [ 'view', 'edit', 'embed' ],
						],
						'reviewUrl'   => [
							'description' => __( 'Product review URL.', 'web-stories' ),
							'type'        => 'string',
							'format'      => 'uri',
							'context'     => [ 'view', 'edit', 'embed' ],
						],
					],
					'context'     => [ 'view', 'edit', 'embed' ],
					'readonly'    => true,
				],
				'productDetails'  => [
					'description' => __( 'Product description.', 'web-stories' ),
					'type'        => 'string',
					'context'     => [ 'view', 'edit', 'embed' ],
					'readonly'    => true,
				],
			],
		];

		return $schema;
	}
}
