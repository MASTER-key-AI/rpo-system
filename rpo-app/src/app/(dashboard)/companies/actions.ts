"use server";

import { createCompany, deleteCompany, deleteCase } from "@/lib/actions"
import { createCompanyGroup, deleteCompanyGroup, addCompanyToGroup, removeCompanyFromGroup } from "@/lib/actions/groups"

export async function createCompanyAction(formData: FormData): Promise<{ error?: string }> {
    "use server"
    const name = String(formData.get("name") || "").trim()
    try {
        await createCompany(name)
        return {}
    } catch (error) {
        const detail = error instanceof Error ? error.message : String(error)
        return { error: detail }
    }
}

export async function deleteCompanyAction(formData: FormData) {
    "use server"
    const companyId = String(formData.get("companyId") || "").trim()
    await deleteCompany(companyId)
}

export async function deleteCompanyById(companyId: string): Promise<{ error?: string }> {
    "use server"
    try {
        await deleteCompany(companyId)
        return {}
    } catch (error) {
        const detail = error instanceof Error ? error.message : String(error)
        console.error("[deleteCompanyById] failed", { companyId, detail })
        return { error: detail }
    }
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
