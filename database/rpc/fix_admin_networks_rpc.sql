-- RPC to fetch all networks securely for the Admin Dashboard
CREATE OR REPLACE FUNCTION admin_get_networks()
RETURNS SETOF admin_networks
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT * FROM admin_networks ORDER BY is_mainnet DESC, created_at DESC;
$$;

-- RPC to insert a new network
CREATE OR REPLACE FUNCTION admin_insert_network(
  p_network_name text, 
  p_rpc_url text, 
  p_chain_id text, 
  p_explorer_url text, 
  p_symbol text, 
  p_is_mainnet boolean
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  INSERT INTO admin_networks (network_name, rpc_url, chain_id, explorer_url, symbol, is_mainnet, is_active)
  VALUES (p_network_name, p_rpc_url, p_chain_id, p_explorer_url, p_symbol, p_is_mainnet, true);
$$;

-- RPC to update a network
CREATE OR REPLACE FUNCTION admin_update_network(
  p_id uuid, 
  p_network_name text, 
  p_rpc_url text, 
  p_chain_id text, 
  p_explorer_url text, 
  p_symbol text, 
  p_is_mainnet boolean
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE admin_networks 
  SET network_name = p_network_name, 
      rpc_url = p_rpc_url, 
      chain_id = p_chain_id, 
      explorer_url = p_explorer_url, 
      symbol = p_symbol, 
      is_mainnet = p_is_mainnet,
      updated_at = now()
  WHERE id = p_id;
$$;

-- RPC to toggle active status
CREATE OR REPLACE FUNCTION admin_toggle_network(p_id uuid, p_is_active boolean)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE admin_networks SET is_active = p_is_active, updated_at = now() WHERE id = p_id;
$$;

-- RPC to delete a network
CREATE OR REPLACE FUNCTION admin_delete_network(p_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  DELETE FROM admin_networks WHERE id = p_id;
$$;
