from rest_framework import permissions


class UsuarioPermission(permissions.BasePermission):
    def has_permission(self, request, view):
        if view.action == 'me':
            return True
        if request.method in permissions.SAFE_METHODS:
            return True
        return request.user.is_authenticated and (
            request.user.tipo == 'admin' or request.user.is_superuser
        )

    def has_object_permission(self, request, view, obj):
        if view.action == 'me':
            return True
        if request.method in permissions.SAFE_METHODS:
            return True
        return request.user.tipo == 'admin' or request.user.is_superuser
