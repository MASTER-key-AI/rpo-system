"use server";

import { deleteCompany, deleteCase } from "@/lib/actions"
import { createCompanyGroup, deleteCompanyGroup, addCompanyToGroup, removeCompanyFromGroup } from "@/lib/actions/groups"

export async function deleteCompanyAction(formData: FormData) {
    "use server"
    const companyId = String(formData.get("companyId") || "").trim()
    await deleteCompany(companyId)
}

export async function deleteCompanyById(companyId: string): Promise<void> {
    "use server"
    await deleteCompany(companyId)
}

export async function deleteCaseAction(formData: FormData) {
    "use server"
    const companyId = String(formData.get("companyId") || "").trim()
    const caseName = String(formData.get("caseName") || "")
    await deleteCase(companyId, caseName)
}

export async function createGroupAction(formData: FormData) {
    "use server"
    const name = String(formData.get("name") || "").trim()
    await createCompanyGroup(name)
}

export async function deleteGroupAction(formData: FormData) {
    "use server"
    const groupId = String(formData.get("groupId") || "").trim()
    await deleteCompanyGroup(groupId)
}

export async function setCompanyGroupAction(formData: FormData) {
    "use server"
    const companyId = String(formData.get("companyId") || "").trim()
    const groupId = String(formData.get("groupId") || "").trim()

    if (groupId) {
        await addCompanyToGroup(companyId, groupId)
    } else {
        await removeCompanyFromGroup(companyId)
    }
}
