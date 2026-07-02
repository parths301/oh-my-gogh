import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Users } from "@medusajs/icons"
import {
  Badge, Button, Container, Drawer, Heading, Input, Label, Switch, Table, Text, Textarea, toast,
} from "@medusajs/ui"
import { useEffect, useState } from "react"
import { adminFetch, handleFor } from "../../lib/client"

type Artist = {
  id: string; name: string; handle: string; medium: string; location: string
  tint: string; quote: string; bio: string; instagram: string; portfolio: string
  image_url: string | null; featured: boolean; status: "active" | "inactive"
}

const EMPTY: Partial<Artist> = {
  name: "", handle: "", medium: "", location: "", tint: "20,42,84",
  quote: "", bio: "", instagram: "", portfolio: "", featured: false, status: "active",
}

const ArtistsPage = () => {
  const [artists, setArtists] = useState<Artist[]>([])
  const [editing, setEditing] = useState<Partial<Artist> | null>(null)
  const [busy, setBusy] = useState(false)

  const load = () =>
    adminFetch<{ artists: Artist[] }>("/admin/artists").then((d) => setArtists(d.artists))
  useEffect(() => { load().catch((e) => toast.error(e.message)) }, [])

  const save = async () => {
    if (!editing?.name) return toast.error("Name is required")
    setBusy(true)
    try {
      const body = { ...editing, handle: editing.handle || handleFor(editing.name!) }
      if (editing.id) {
        const { id, ...patch } = body
        await adminFetch(`/admin/artists/${editing.id}`, { json: patch })
      } else {
        await adminFetch("/admin/artists", { json: body })
      }
      toast.success("Artist saved")
      setEditing(null)
      await load()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async (a: Artist) => {
    if (!confirm(`Delete ${a.name}?`)) return
    await adminFetch(`/admin/artists/${a.id}`, { method: "DELETE" })
    toast.success("Artist deleted")
    await load()
  }

  const field = (key: keyof Artist, label: string, textarea = false) => (
    <div className="flex flex-col gap-y-1">
      <Label size="small">{label}</Label>
      {textarea ? (
        <Textarea rows={3} value={(editing?.[key] as string) || ""}
          onChange={(e) => setEditing({ ...editing, [key]: e.target.value })} />
      ) : (
        <Input value={(editing?.[key] as string) || ""}
          onChange={(e) => setEditing({ ...editing, [key]: e.target.value })} />
      )}
    </div>
  )

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">Artists</Heading>
        <Button size="small" onClick={() => setEditing({ ...EMPTY })}>Add artist</Button>
      </div>
      <Table>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>Name</Table.HeaderCell>
            <Table.HeaderCell>Medium</Table.HeaderCell>
            <Table.HeaderCell>Location</Table.HeaderCell>
            <Table.HeaderCell>Featured</Table.HeaderCell>
            <Table.HeaderCell>Status</Table.HeaderCell>
            <Table.HeaderCell />
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {artists.map((a) => (
            <Table.Row key={a.id}>
              <Table.Cell>{a.name}</Table.Cell>
              <Table.Cell>{a.medium}</Table.Cell>
              <Table.Cell>{a.location}</Table.Cell>
              <Table.Cell>{a.featured ? "★" : ""}</Table.Cell>
              <Table.Cell>
                <Badge size="2xsmall" color={a.status === "active" ? "green" : "grey"}>{a.status}</Badge>
              </Table.Cell>
              <Table.Cell className="text-right">
                <Button size="small" variant="transparent" onClick={() => setEditing(a)}>Edit</Button>
                <Button size="small" variant="transparent" className="text-ui-fg-error" onClick={() => remove(a)}>Delete</Button>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
      <Drawer open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>{editing?.id ? "Edit artist" : "New artist"}</Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="flex flex-col gap-y-4 overflow-y-auto">
            {field("name", "Name")}
            {field("medium", "Medium")}
            {field("location", "Location")}
            {field("quote", "Quote")}
            {field("bio", "Bio", true)}
            {field("instagram", "Instagram")}
            {field("portfolio", "Portfolio URL")}
            {field("tint", "Tint (r,g,b)")}
            {field("image_url", "Portrait image URL")}
            <div className="flex items-center gap-x-3">
              <Switch checked={!!editing?.featured}
                onCheckedChange={(v) => setEditing({ ...editing, featured: v })} />
              <Label size="small">Featured on the storefront</Label>
            </div>
            <div className="flex items-center gap-x-3">
              <Switch checked={editing?.status !== "inactive"}
                onCheckedChange={(v) => setEditing({ ...editing, status: v ? "active" : "inactive" })} />
              <Label size="small">Active</Label>
            </div>
            <Text size="small" className="text-ui-fg-subtle">
              Portraits: upload the file under Settings → …or host it anywhere and paste the URL here.
            </Text>
          </Drawer.Body>
          <Drawer.Footer>
            <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={save} isLoading={busy}>Save</Button>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Artists",
  icon: Users,
})

export default ArtistsPage
