def test_two_tenants_fixture_sanity(two_tenants):
    """Sanity check: fixture cria objetos com FKs e tenants corretos."""
    assert two_tenants.tenant_a.id != two_tenants.tenant_b.id
    assert two_tenants.admin_a.tenant_id == two_tenants.tenant_a.id
    assert two_tenants.admin_b.tenant_id == two_tenants.tenant_b.id
    assert two_tenants.cliente_a.tenant_id == two_tenants.tenant_a.id
    assert two_tenants.cliente_a.user_id == two_tenants.admin_a.id
    assert two_tenants.caso_a.cliente_id == two_tenants.cliente_a.id
    assert two_tenants.caso_a.user_id == two_tenants.admin_a.id
    assert two_tenants.caso_a.tenant_id == two_tenants.tenant_a.id
    assert two_tenants.cliente_b.tenant_id == two_tenants.tenant_b.id
    assert two_tenants.caso_b.cliente_id == two_tenants.cliente_b.id
    assert two_tenants.caso_b.tenant_id == two_tenants.tenant_b.id
