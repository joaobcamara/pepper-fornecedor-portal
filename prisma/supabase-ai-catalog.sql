create or replace view ai_product_catalog as
select
  cp.id as product_id,
  cv.id as variant_id,
  cp.sku_parent,
  cv.sku,
  cp.name,
  cp.brand,
  cp.category_path,
  cp.material,
  cp.composition,
  cp.gender,
  cp.model,
  cp.style,
  cv.size_label,
  cv.color_label,
  ci.available_multi_company_stock,
  case
    when ci.available_multi_company_stock is not null and ci.available_multi_company_stock > 0 then true
    else false
  end as in_stock,
  cp.main_image_url,
  coalesce(cv.sales_context_ai, cp.sales_context_ai) as sales_context_ai,
  coalesce(cv.search_text, cp.search_text) as search_text,
  coalesce(cv.intent_tags, cp.intent_tags) as intent_tags,
  cpr.sale_price,
  cpr.promotional_price,
  ci.stock_status,
  ci.inventory_sync_status,
  ci.last_stock_sync_at
from "CatalogProduct" cp
join "CatalogVariant" cv on cv.catalog_product_id = cp.id
left join "CatalogInventory" ci on ci.catalog_variant_id = cv.id
left join "CatalogPrice" cpr on cpr.catalog_variant_id = cv.id
where cp.active = true
  and cv.active = true;

comment on view ai_product_catalog is
'Camada pronta para IA de atendimento consultar variações com estoque multiempresa, preço, imagem e contexto comercial.';

create or replace view ai_customer_360 as
select
  c.id as customer_id,
  c.tiny_contact_id,
  c.name,
  c.trade_name,
  c.document,
  c.email,
  c.phone,
  c.mobile_phone,
  c.city,
  c.state,
  c.customer_context_ai,
  c.search_text,
  c.intent_tags,
  count(distinct so.id) as total_orders,
  coalesce(sum(so.total_amount), 0) as total_revenue,
  max(so.order_date) as last_order_at
from "Customer" c
left join "SalesOrder" so on so.customer_id = c.id
group by
  c.id,
  c.tiny_contact_id,
  c.name,
  c.trade_name,
  c.document,
  c.email,
  c.phone,
  c.mobile_phone,
  c.city,
  c.state,
  c.customer_context_ai,
  c.search_text,
  c.intent_tags;

comment on view ai_customer_360 is
'Visao consolidada de clientes para AtendimentoIA consultar historico, contato e ultima compra.';

create or replace view ai_order_360 as
select
  so.id as sales_order_id,
  so.tiny_order_id,
  so.number,
  so.ecommerce_number,
  so.status,
  so.status_label,
  so.channel,
  so.marketplace,
  so.order_date,
  so.total_amount,
  so.customer_id,
  c.name as customer_name,
  c.document as customer_document,
  so.order_context_ai,
  json_agg(
    json_build_object(
      'sku', soi.sku,
      'skuParent', soi.sku_parent,
      'productName', soi.product_name,
      'quantity', soi.quantity,
      'unitPrice', soi.unit_price,
      'totalPrice', soi.total_price
    )
    order by soi.created_at
  ) filter (where soi.id is not null) as items
from "SalesOrder" so
left join "Customer" c on c.id = so.customer_id
left join "SalesOrderItem" soi on soi.sales_order_id = so.id
group by
  so.id,
  so.tiny_order_id,
  so.number,
  so.ecommerce_number,
  so.status,
  so.status_label,
  so.channel,
  so.marketplace,
  so.order_date,
  so.total_amount,
  so.customer_id,
  c.name,
  c.document,
  so.order_context_ai;

comment on view ai_order_360 is
'Visao consolidada de pedidos para AtendimentoIA navegar por cliente, pedido e itens comprados.';
