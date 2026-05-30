CREATE OR REPLACE FUNCTION admin_update_cardholder_name(p_card_id uuid, p_is_vcc boolean, p_new_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_is_vcc THEN
    UPDATE vcc_cards SET card_holder_name = p_new_name WHERE id = p_card_id;
  ELSE
    UPDATE cards SET holder_name = p_new_name WHERE id = p_card_id;
  END IF;
END;
$$;
