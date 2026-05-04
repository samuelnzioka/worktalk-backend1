/**
 * Data Cleanup Script
 * Fixes corrupted company admin assignments
 * 
 * Usage: node scripts/fixCompanyAdminData.js
 */

const mongoose = require('mongoose');
const Company = require('../models/company');
const User = require('../models/user');
const CompanyEmployee = require('../models/companyemployee');
const Department = require('../models/department');

require('dotenv').config();

async function fixCompanyAdminData() {
    try {
        // Connect to database
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/worktalk');
        console.log('Connected to database');

        // Step 1: Find all companies with adminId
        const companies = await Company.find({ adminId: { $exists: true } });
        console.log(`\nFound ${companies.length} companies with adminId`);

        // Step 2: For each company, verify the admin assignment
        for (const company of companies) {
            console.log(`\n--- Processing company: ${company.name} (${company._id}) ---`);
            console.log(`Current adminId: ${company.adminId}`);

            // Find the CompanyEmployee record for the supposed admin
            const adminEmployee = await CompanyEmployee.findOne({
                company: company._id,
                user: company.adminId
            }).populate('user', 'name email');

            if (!adminEmployee) {
                console.log(`⚠️  WARNING: CompanyEmployee record not found for admin user ${company.adminId}`);
                continue;
            }

            console.log(`Admin employee: ${adminEmployee.user.name} (${adminEmployee.user.email})`);
            console.log(`Admin employee verified: ${adminEmployee.isVerified}, active: ${adminEmployee.isActive}`);

            // Check if the admin user has this company in their profiles
            const adminUser = await User.findById(company.adminId);
            if (!adminUser) {
                console.log(`❌ ERROR: Admin user not found in database`);
                continue;
            }

            const companyProfile = adminUser.profiles.find(p => 
                p.companyId && p.companyId.toString() === company._id.toString()
            );

            if (!companyProfile) {
                console.log(`⚠️  WARNING: Admin user does not have this company in their profiles`);
                console.log(`   Adding company profile to admin user...`);
                
                // Get the first department for the company
                const firstDepartment = await Department.findOne({ companyId: company._id });
                
                adminUser.profiles.push({
                    type: 'employee',
                    username: adminUser.name.replace(/\s+/g, '').toLowerCase(),
                    companyId: company._id,
                    departmentId: firstDepartment?._id,
                    isActive: true,
                    isEmployeeVerified: true,
                    verifiedAt: new Date()
                });
                
                await adminUser.save();
                console.log(`   ✓ Company profile added`);
            } else {
                console.log(`✓ Admin user has correct company profile`);
            }

            // Step 3: Check for other users who might have this company in their profiles incorrectly
            const usersWithCompanyProfile = await User.find({
                'profiles.companyId': company._id,
                _id: { $ne: company.adminId }
            });

            if (usersWithCompanyProfile.length > 0) {
                console.log(`\n⚠️  Found ${usersWithCompanyProfile.length} other users with this company in their profiles:`);
                
                for (const user of usersWithCompanyProfile) {
                    console.log(`   - ${user.name} (${user.email})`);
                    
                    // Check if this user actually has a CompanyEmployee record
                    const employeeRecord = await CompanyEmployee.findOne({
                        user: user._id,
                        company: company._id
                    });

                    if (!employeeRecord) {
                        console.log(`     ❌ No CompanyEmployee record - removing company profile`);
                        user.profiles = user.profiles.filter(p => 
                            !p.companyId || p.companyId.toString() !== company._id.toString()
                        );
                        await user.save();
                        console.log(`     ✓ Company profile removed`);
                    } else {
                        console.log(`     ✓ Has valid CompanyEmployee record - keeping profile`);
                    }
                }
            }
        }

        // Step 4: Check for companies without adminId but with CompanyEmployee records
        const companiesWithoutAdmin = await Company.find({ adminId: { $exists: false } });
        console.log(`\n\n--- Companies without adminId ---`);
        console.log(`Found ${companiesWithoutAdmin.length} companies`);

        for (const company of companiesWithoutAdmin) {
            console.log(`\nCompany: ${company.name} (${company._id})`);
            
            // Find the first verified employee who could be admin
            const firstEmployee = await CompanyEmployee.findOne({
                company: company._id,
                isVerified: true,
                isActive: true
            }).populate('user', 'name email');

            if (firstEmployee) {
                console.log(`Setting admin to first employee: ${firstEmployee.user.name}`);
                company.adminId = firstEmployee.user._id;
                await company.save();
                console.log(`✓ Admin set`);
            } else {
                console.log(`⚠️  No verified employees found for this company`);
            }
        }

        // Step 5: Report final state
        const finalCompanies = await Company.find();
        console.log(`\n\n=== FINAL STATE ===`);
        console.log(`Total companies: ${finalCompanies.length}`);
        
        const adminCounts = {};
        for (const company of finalCompanies) {
            const adminId = company.adminId?.toString();
            if (adminId) {
                adminCounts[adminId] = (adminCounts[adminId] || 0) + 1;
            }
        }

        console.log(`\nAdmin distribution:`);
        for (const [adminId, count] of Object.entries(adminCounts)) {
            const adminUser = await User.findById(adminId);
            console.log(`  ${adminUser?.name || 'Unknown'}: ${count} companies`);
        }

        console.log('\n✅ Data cleanup completed successfully');
        process.exit(0);

    } catch (error) {
        console.error('❌ Error during cleanup:', error);
        process.exit(1);
    }
}

// Run the cleanup
fixCompanyAdminData();
