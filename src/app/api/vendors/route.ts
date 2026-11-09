import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';
import { getUserSession, unauthorizedResponse, forbiddenResponse } from '@/lib/authGuard';
import { generateNodeId, generateQuotePrefix } from '@/lib/multiTenant';
import { companies } from '@/lib/companyDetails';

// GET - List all vendors or get single vendor
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        const slug = searchParams.get('slug');
        const activeOnly = searchParams.get('active') === 'true';

        const supabase = getServerSupabase();

        if (id) {
            const { data, error } = await supabase
                .from('vendors')
                .select('*, vendor_users(id, email, role, full_name)')
                .eq('id', id)
                .single();
            if (error) throw error;
            return NextResponse.json({ success: true, data });
        }

        if (slug) {
            const { data, error } = await supabase
                .from('vendors')
                .select('*, vendor_users(id, email, role, full_name)')
                .eq('slug', slug)
                .single();
            if (error) throw error;
            return NextResponse.json({ success: true, data });
        }

        let query = supabase
            .from('vendors')
            .select('*, quotations:quotations!quotations_vendor_id_fkey(count), vendor_users(id, email, role, full_name)')
            .order('name', { ascending: true });

        if (activeOnly) {
            query = query.eq('status', 'active');
        }

        const { data, error } = await query;
        if (error) throw error;

        return NextResponse.json({ success: true, data: data || [] });
    } catch (error: any) {
        console.error('Fetch vendors error:', error);
        // Fallback to default companies if DB is temporarily unreachable
        const fallbackVendors = companies.map(c => ({
            id: c.id,
            name: c.name,
            slug: c.slug,
            node_id: 'NODE-VNS-001',
            quote_prefix: 'KSS',
            phone: c.phone,
            email: c.email,
            authorized_signatory: c.authorizedSignatory,
            logo_url: c.logo,
            status: 'active',
            from_fallback: true
        }));
        return NextResponse.json({ success: true, data: fallbackVendors, fromFallback: true });
    }
}

// POST - Create a new vendor and optionally create their login credentials
export async function POST(request: Request) {
    const session = await getUserSession(request);
    if (!session) return unauthorizedResponse();
    if (!session.isSuperAdmin) return forbiddenResponse('Only Super Administrators can create vendors');

    try {
        const body = await request.json();
        const {
            name,
            tagline,
            node_id: inputNodeId,
            quote_prefix: inputQuotePrefix,
            qr_code_url,
            plan_tier = 'pro',
            is_demo = false,
            gstin,
            phone,
            alternate_phone,
            email,
            password,
            head_office,
            registered_office,
            bank_name,
            bank_branch,
            account_name,
            account_number,
            ifsc,
            upi_id,
            logo_url,
            signature_url,
            stamp_url,
            authorized_signatory,
            default_margin,
            components_settings,
            role = 'vendor'
        } = body;

        if (!name) {
            return NextResponse.json({ success: false, message: 'Vendor/Company name is required' }, { status: 400 });
        }

        const supabase = getServerSupabase();

        // Auto-generate Node ID and Quote Prefix if not supplied
        const generatedNodeId = (inputNodeId && inputNodeId.trim()) 
            ? inputNodeId.trim().toUpperCase() 
            : await generateNodeId(name, head_office || registered_office || '');

        const generatedQuotePrefix = (inputQuotePrefix && inputQuotePrefix.trim())
            ? inputQuotePrefix.trim().toUpperCase()
            : generateQuotePrefix(name);

        // Generate unique slug
        const baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        const slug = `${baseSlug}-${Date.now().toString().slice(-4)}`;

        // 1. Insert into vendors table
        const vendorPayload: any = {
            name: name.trim(),
            slug,
            node_id: generatedNodeId,
            quote_prefix: generatedQuotePrefix,
            qr_code_url: qr_code_url || null,
            plan_tier: plan_tier || 'pro',
            is_demo: Boolean(is_demo),
            tagline: tagline || null,
            gstin: gstin || null,
            phone: phone || null,
            alternate_phone: alternate_phone || null,
            email: email || null,
            head_office: head_office || null,
            registered_office: registered_office || null,
            bank_name: bank_name || null,
            bank_branch: bank_branch || null,
            account_name: account_name || name.trim().toUpperCase(),
            account_number: account_number || null,
            ifsc: ifsc || null,
            upi_id: upi_id || null,
            logo_url: logo_url || '/logo.png',
            signature_url: signature_url || '/signature.png',
            stamp_url: stamp_url || '/stamp.png',
            authorized_signatory: authorized_signatory || null,
            default_margin: Number(default_margin) || 0,
            components_settings: components_settings || {},
            status: 'active',
        };

        const { data: newVendor, error: vendorError } = await supabase
            .from('vendors')
            .insert([vendorPayload])
            .select()
            .single();

        if (vendorError) throw vendorError;

        let createdAuthUser: any = null;

        // 2. If email and password provided, create Supabase Auth User
        if (email && password) {
            const { data: authData, error: authError } = await supabase.auth.admin.createUser({
                email: email.trim(),
                password: password,
                email_confirm: true,
                user_metadata: {
                    vendor_id: newVendor.id,
                    vendor_name: newVendor.name,
                    role: role,
                }
            });

            if (authError) {
                console.warn('Auth user creation warning:', authError.message);
                if (authError.message?.toLowerCase().includes('already') || authError.message?.toLowerCase().includes('exists')) {
                    try {
                        const { data: userList } = await supabase.auth.admin.listUsers();
                        const existingUser = userList?.users?.find((u: any) => u.email?.toLowerCase() === email.trim().toLowerCase());
                        if (existingUser) {
                            await supabase.auth.admin.updateUserById(existingUser.id, {
                                password: password,
                                user_metadata: {
                                    vendor_id: newVendor.id,
                                    vendor_name: newVendor.name,
                                    role: role,
                                }
                            });
                            createdAuthUser = existingUser;
                            await supabase.from('vendor_users').upsert([{
                                id: existingUser.id,
                                vendor_id: newVendor.id,
                                role: role,
                                full_name: authorized_signatory || name,
                                email: email.trim(),
                            }]);
                        }
                    } catch (linkErr) {
                        console.warn('Could not link existing auth user:', linkErr);
                    }
                }
            } else if (authData?.user) {
                createdAuthUser = authData.user;
                // Insert into vendor_users
                await supabase.from('vendor_users').insert([{
                    id: createdAuthUser.id,
                    vendor_id: newVendor.id,
                    role: role,
                    full_name: authorized_signatory || name,
                    email: email.trim(),
                }]);
            }
        }

        return NextResponse.json({
            success: true,
            message: 'Vendor created successfully',
            data: newVendor,
            authCreated: !!createdAuthUser,
        });
    } catch (error: any) {
        console.error('Create vendor error:', error);
        return NextResponse.json({ success: false, message: error.message || 'Failed to create vendor' }, { status: 500 });
    }
}

// PUT - Update vendor details & credentials
export async function PUT(request: Request) {
    const session = await getUserSession(request);
    if (!session) return unauthorizedResponse();

    try {
        const body = await request.json();
        const { id, login_email, password, role = 'vendor', ...updates } = body;

        if (!id) {
            return NextResponse.json({ success: false, message: 'Vendor ID is required' }, { status: 400 });
        }

        // Strict RBAC: regular vendors can only update their own record and cannot alter system fields
        if (!session.isSuperAdmin) {
            if (session.vendor_id !== id) {
                return forbiddenResponse('You can only update your own vendor profile');
            }
            delete updates.node_id;
            delete updates.plan_tier;
            delete updates.is_demo;
            delete updates.quote_prefix;
            delete updates.status;
        }

        const supabase = getServerSupabase();

        // 1. Handle Login Credentials (User ID / Email & Password)
        let authMessage = '';
        const targetEmail = (login_email || (password ? updates.email : '') || '').trim();
        const targetPassword = password ? password.trim() : '';

        if (targetPassword || targetEmail) {
            // Find existing vendor_users for this vendor
            const { data: vUsers } = await supabase
                .from('vendor_users')
                .select('id, email')
                .eq('vendor_id', id);

            if (vUsers && vUsers.length > 0) {
                // Update existing user(s)
                for (const vu of vUsers) {
                    const authUpdatePayload: any = {};
                    if (targetPassword) {
                        if (targetPassword.length < 6) {
                            return NextResponse.json({ success: false, message: 'Password must be at least 6 characters' }, { status: 400 });
                        }
                        authUpdatePayload.password = targetPassword;
                    }
                    if (targetEmail && targetEmail !== vu.email) {
                        authUpdatePayload.email = targetEmail;
                        await supabase.from('vendor_users').update({ email: targetEmail }).eq('id', vu.id);
                    }
                    if (Object.keys(authUpdatePayload).length > 0) {
                        const { error: updateAuthErr } = await supabase.auth.admin.updateUserById(vu.id, authUpdatePayload);
                        if (updateAuthErr) throw updateAuthErr;
                    }
                }
                authMessage = 'Login credentials updated successfully.';
            } else if (targetEmail && targetPassword) {
                // Create brand new login account for this vendor
                if (targetPassword.length < 6) {
                    return NextResponse.json({ success: false, message: 'Password must be at least 6 characters' }, { status: 400 });
                }
                const { data: newAuthData, error: createAuthErr } = await supabase.auth.admin.createUser({
                    email: targetEmail,
                    password: targetPassword,
                    email_confirm: true,
                    user_metadata: {
                        vendor_id: id,
                        vendor_name: updates.name,
                        role: role,
                    }
                });

                if (createAuthErr) throw createAuthErr;

                if (newAuthData?.user) {
                    await supabase.from('vendor_users').insert([{
                        id: newAuthData.user.id,
                        vendor_id: id,
                        role: role,
                        full_name: updates.authorized_signatory || updates.name || 'Vendor Admin',
                        email: targetEmail,
                    }]);
                    authMessage = 'Login user account created successfully.';
                }
            }
        }

        // Clean out any fields that do not belong to the vendors table
        delete updates.password;
        delete updates.login_email;
        delete updates.vendor_users;
        delete updates.quotations;
        delete updates.role;

        const updatePayload: any = {
            ...updates,
            updated_at: new Date().toISOString(),
        };

        const { data, error } = await supabase
            .from('vendors')
            .update(updatePayload)
            .eq('id', id)
            .select('*, vendor_users(id, email, role, full_name)')
            .single();

        if (error) throw error;

        return NextResponse.json({
            success: true,
            message: authMessage ? `Vendor and ${authMessage}` : 'Vendor updated successfully',
            data,
        });
    } catch (error: any) {
        console.error('Update vendor error:', error);
        return NextResponse.json({ success: false, message: error.message || 'Failed to update vendor' }, { status: 500 });
    }
}

// DELETE - Deactivate/Delete vendor
export async function DELETE(request: Request) {
    const session = await getUserSession(request);
    if (!session) return unauthorizedResponse();
    if (!session.isSuperAdmin) return forbiddenResponse('Only Super Administrators can deactivate vendors');

    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ success: false, message: 'Vendor ID is required' }, { status: 400 });
        }

        const supabase = getServerSupabase();

        // Soft delete (set status to suspended)
        const { error } = await supabase
            .from('vendors')
            .update({ status: 'suspended', updated_at: new Date().toISOString() })
            .eq('id', id);

        if (error) throw error;

        return NextResponse.json({ success: true, message: 'Vendor deactivated successfully' });
    } catch (error: any) {
        console.error('Delete vendor error:', error);
        return NextResponse.json({ success: false, message: error.message || 'Failed to deactivate vendor' }, { status: 500 });
    }
}
