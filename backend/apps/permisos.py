from rest_framework import permissions


class SoloAdmin(permissions.BasePermission):
    """Solo admin tiene acceso."""
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated
                    and request.user.tipo == 'admin')

class AdminOVendedor(permissions.BasePermission):
    """Admin y vendedor tienen acceso."""
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated
                    and request.user.tipo in ('admin', 'vendedor'))

    def has_object_permission(self, request, view, obj):
        return self.has_permission(request, view)

class AdminOVendedorCreate(permissions.BasePermission):
    """Admin y vendedor crean/leen. Solo admin modifica/borra."""
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS or request.method == 'POST':
            return bool(request.user and request.user.is_authenticated
                        and request.user.tipo in ('admin', 'vendedor'))
        return bool(request.user and request.user.is_authenticated
                    and request.user.tipo == 'admin')
